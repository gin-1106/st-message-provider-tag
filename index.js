/**
 * Message Provider Tag
 * 同时显示：模型名 + (连接配置名)
 * 请关闭酒馆助手里单独的「模型名」脚本，避免抢 DOM。
 */

const MODULE = 'message-provider-tag';
const EXTRA_PROVIDER = 'tt_provider';
const EXTRA_MODEL = 'tt_model';

function getSettings() {
    const ctx = SillyTavern.getContext();
    const root = ctx.extensionSettings || window.extension_settings || {};
    if (!root[MODULE]) {
        root[MODULE] = {
            enabled: true,
            showModel: true,
            showProvider: true,
        };
    }
    return root[MODULE];
}

function getConnectionProfileName() {
    try {
        const ext =
            SillyTavern.getContext().extensionSettings ||
            window.extension_settings ||
            {};
        const cm = ext.connectionManager;
        if (!cm || !cm.selectedProfile) return '';
        const hit = (cm.profiles || []).find((p) => p && p.id === cm.selectedProfile);
        if (hit && hit.name) return String(hit.name).trim();
        const text = String($('#connection_profiles option:selected').text() || '').trim();
        if (text && text !== '<None>' && text.toLowerCase() !== 'none') return text;
    } catch (e) {
        console.warn(`[${MODULE}] profile`, e);
    }
    return '';
}

function getCurrentModelName() {
    try {
        const ctx = SillyTavern.getContext();
        const s = ctx.chatCompletionSettings || {};
        const oai = window.oai_settings || {};
        const list = [
            s.openai_model,
            s.custom_model,
            oai.openai_model,
            oai.custom_model,
            $('#custom_model_id').val(),
            $('#model_openai_select').val(),
        ];
        return list.map((x) => String(x || '').trim()).find(Boolean) || '';
    } catch (e) {
        return '';
    }
}

function isGenerating() {
    return !!(
        document.querySelector('.mes_stop, #mes_stop, .streaming-cursor') ||
        window.is_send_press ||
        window.is_generating
    );
}

function saveChatSafe() {
    try {
        const ctx = SillyTavern.getContext();
        if (typeof ctx.saveChat === 'function') {
            ctx.saveChat();
            return;
        }
    } catch (e) {}
    if (typeof saveChatDebounced === 'function') saveChatDebounced();
    else if (typeof saveChatConditional === 'function') saveChatConditional();
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** 整行自己画，不依赖别的脚本的 .tt-model-tag */
function stampMeta($mes, modelName, providerName) {
    if (!$mes || !$mes.length) return;

    const settings = getSettings();
    if (!settings.enabled) {
        $mes.find('.tt-meta-line').remove();
        return;
    }

    const model = settings.showModel ? modelName || '' : '';
    const provider = settings.showProvider ? providerName || '' : '';
    if (!model && !provider) {
        $mes.find('.tt-meta-line').remove();
        return;
    }

    let $line = $mes.find('.tt-meta-line').first();
    if (!$line.length) {
        $line = $('<div class="tt-meta-line"></div>');
        // 插在正文上方、按钮下方：优先 mes_text 前面
        const $text = $mes.find('.mes_text').first();
        if ($text.length) {
            $text.before($line);
        } else {
            $mes.find('.mes_block').first().append($line);
        }
    }

    const modelHtml = model
        ? `<span class="tt-model-part">${escapeHtml(model)}</span>`
        : '';
    const providerHtml = provider
        ? `<span class="tt-provider-part"> (${escapeHtml(provider)})</span>`
        : '';
    const next = modelHtml + providerHtml;
    if ($line.html() !== next) {
        $line.html(next);
    }
}

function bindLastAssistantMessage() {
    const settings = getSettings();
    if (!settings.enabled) return;

    const provider = getConnectionProfileName();
    const model = getCurrentModelName();
    if (!provider && !model) return;

    const ctx = SillyTavern.getContext();
    const chat = ctx.chat || [];
    let lastAi = -1;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i] && !chat[i].is_user) {
            lastAi = i;
            break;
        }
    }
    if (lastAi < 0) return;

    const mes = chat[lastAi];
    mes.extra = mes.extra || {};
    let changed = false;
    if (provider && mes.extra[EXTRA_PROVIDER] !== provider) {
        mes.extra[EXTRA_PROVIDER] = provider;
        changed = true;
    }
    if (model && mes.extra[EXTRA_MODEL] !== model) {
        mes.extra[EXTRA_MODEL] = model;
        changed = true;
    }
    if (changed) saveChatSafe();

    stampMeta(
        $(`.mes[mesid="${lastAi}"]`),
        mes.extra[EXTRA_MODEL] || model,
        mes.extra[EXTRA_PROVIDER] || provider,
    );
}

function renderAll() {
    const settings = getSettings();
    const ctx = SillyTavern.getContext();
    const chat = ctx.chat || [];
    const generating = isGenerating();
    let lastAi = -1;
    for (let i = chat.length - 1; i >= 0; i--) {
        if (chat[i] && !chat[i].is_user) {
            lastAi = i;
            break;
        }
    }

    chat.forEach((mes, i) => {
        if (!mes || mes.is_user) return;
        let model = settings.enabled ? mes.extra?.[EXTRA_MODEL] || '' : '';
        let provider = settings.enabled ? mes.extra?.[EXTRA_PROVIDER] || '' : '';
        // 正在生成且还没写入：用当前值
        if (generating && i === lastAi) {
            if (!model) model = getCurrentModelName();
            if (!provider) provider = getConnectionProfileName();
        }
        stampMeta($(`.mes[mesid="${i}"]`), model, provider);
    });
}

function onMessageDone() {
    bindLastAssistantMessage();
    renderAll();
}

function scheduleRender() {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            renderAll();
        });
    });
}

function addSettings() {
    if ($('#mpt_enabled').length) return;
    const settings = getSettings();
    const html = `
    <div class="message-provider-tag-settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Message Provider Tag</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label">
                    <input type="checkbox" id="mpt_enabled" ${settings.enabled ? 'checked' : ''}>
                    <span>启用</span>
                </label>
                <label class="checkbox_label">
                    <input type="checkbox" id="mpt_show_model" ${settings.showModel !== false ? 'checked' : ''}>
                    <span>显示模型名</span>
                </label>
                <label class="checkbox_label">
                    <input type="checkbox" id="mpt_show_provider" ${settings.showProvider !== false ? 'checked' : ''}>
                    <span>显示连接配置名</span>
                </label>
                <small>请关闭酒馆助手里单独的模型名脚本，只留本扩展。</small>
            </div>
        </div>
    </div>`;
    $('#extensions_settings').append(html);

    const save = () => {
        try {
            const ctx = SillyTavern.getContext();
            if (typeof ctx.saveSettingsDebounced === 'function') ctx.saveSettingsDebounced();
            else if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
        } catch (e) {}
        renderAll();
    };
    $('#mpt_enabled').on('input', function () {
        getSettings().enabled = !!$(this).prop('checked');
        save();
    });
    $('#mpt_show_model').on('input', function () {
        getSettings().showModel = !!$(this).prop('checked');
        save();
    });
    $('#mpt_show_provider').on('input', function () {
        getSettings().showProvider = !!$(this).prop('checked');
        save();
    });
}

jQuery(async () => {
    const ctx = SillyTavern.getContext();
    const { eventSource, eventTypes } = ctx;
    const types = eventTypes || ctx.event_types || window.event_types || {};

    addSettings();
    renderAll();

    eventSource.on(types.GENERATION_STARTED || 'GENERATION_STARTED', scheduleRender);
    eventSource.on(types.STREAM_TOKEN_RECEIVED || 'STREAM_TOKEN_RECEIVED', scheduleRender);
    eventSource.on(types.CHARACTER_MESSAGE_RENDERED || 'CHARACTER_MESSAGE_RENDERED', scheduleRender);
    eventSource.on(types.MESSAGE_RECEIVED || 'MESSAGE_RECEIVED', onMessageDone);
    eventSource.on(types.GENERATION_ENDED || 'GENERATION_ENDED', onMessageDone);
    eventSource.on(types.CHAT_CHANGED || 'CHAT_CHANGED', renderAll);

    console.log(`[${MODULE}] loaded`);
});