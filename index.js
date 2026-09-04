/**
 * Message Provider Tag
 * 生成结束写入连接配置名；只显示已存记录；不闪、不挤到行尾。
 */

const MODULE = 'message-provider-tag';
const EXTRA_KEY = 'tt_provider';

function getSettings() {
    const ctx = SillyTavern.getContext();
    const root = ctx.extensionSettings || window.extension_settings || {};
    if (!root[MODULE]) {
        root[MODULE] = { enabled: true };
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
        if (!cm) return '';

        const selected = cm.selectedProfile;
        if (!selected) return '';

        const list = Array.isArray(cm.profiles) ? cm.profiles : [];
        const hit = list.find((p) => p && p.id === selected);
        if (hit && hit.name) return String(hit.name).trim();

        const text = String(
            $('#connection_profiles option:selected').text() || '',
        ).trim();
        if (text && text !== '<None>' && text.toLowerCase() !== 'none') {
            return text;
        }
    } catch (e) {
        console.warn(`[${MODULE}] getConnectionProfileName failed`, e);
    }
    return '';
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

/**
 * 只更新文字，不乱删重建 → 不闪
 * 括号是模型名的兄弟节点，不在 .tt-model-tag 内部 → 不被 .text() 清掉
 */
function stampProvider($mes, name) {
    if (!$mes || !$mes.length) return;

    const settings = getSettings();
    const want = settings.enabled && name ? ` (${name})` : '';
    let $tag = $mes.find('.tt-provider-tag').first();
    const $model = $mes.find('.tt-model-tag').first();

    if (!want) {
        $tag.remove();
        return;
    }

    // 有模型名：必须和模型名包在同一组里，避免 flex 左右拆开
    if ($model.length) {
        if (!$model.parent().hasClass('tt-model-wrap')) {
            $model.wrap('<span class="tt-model-wrap"></span>');
        }
        const $wrap = $model.parent('.tt-model-wrap');

        if (!$tag.length) {
            $tag = $(`<span class="tt-provider-tag"></span>`);
        }
        // 无论原来在哪，都挪进 wrap，贴在模型名后面
        if ($tag.parent()[0] !== $wrap[0] || $tag.prev()[0] !== $model[0]) {
            $model.after($tag);
        }
        if ($tag.text() !== want) {
            $tag.text(want);
        }
        return;
    }

    // 没有模型名标签时，挂到角色名行
    if (!$tag.length) {
        const $host = $mes
            .find('.mes_block > .ch_name, .mes_block .name_date, .ch_name')
            .first();
        if (!$host.length) return;
        $tag = $(`<span class="tt-provider-tag"></span>`);
        $host.append($tag);
    }
    if ($tag.text() !== want) {
        $tag.text(want);
    }
}

function bindLastAssistantMessage() {
    const settings = getSettings();
    if (!settings.enabled) return;

    const name = getConnectionProfileName();
    if (!name) return;

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
    if (mes.extra[EXTRA_KEY] !== name) {
        mes.extra[EXTRA_KEY] = name;
        saveChatSafe();
    }
    stampProvider($(`.mes[mesid="${lastAi}"]`), name);
}

function renderAll() {
    const settings = getSettings();
    const ctx = SillyTavern.getContext();
    const chat = ctx.chat || [];

    chat.forEach((mes, i) => {
        if (!mes || mes.is_user) return;
        const stored = settings.enabled ? mes.extra?.[EXTRA_KEY] || '' : '';
        stampProvider($(`.mes[mesid="${i}"]`), stored);
    });
}

function onMessageDone() {
    bindLastAssistantMessage();
    renderAll();
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
                    <span>在消息上显示连接配置名</span>
                </label>
                <small>
                    生成完成时写入当前连接配置名。旧楼无记录则不显示。
                </small>
            </div>
        </div>
    </div>`;

    $('#extensions_settings').append(html);
    $('#mpt_enabled').on('input', function () {
        getSettings().enabled = !!$(this).prop('checked');
        try {
            const ctx = SillyTavern.getContext();
            if (typeof ctx.saveSettingsDebounced === 'function') {
                ctx.saveSettingsDebounced();
            } else if (typeof saveSettingsDebounced === 'function') {
                saveSettingsDebounced();
            }
        } catch (e) {}
        renderAll();
    });
}

jQuery(async () => {
    const ctx = SillyTavern.getContext();
    const { eventSource, eventTypes } = ctx;
    const types = eventTypes || ctx.event_types || window.event_types || {};

    const MESSAGE_RECEIVED = types.MESSAGE_RECEIVED || 'MESSAGE_RECEIVED';
    const GENERATION_ENDED = types.GENERATION_ENDED || 'GENERATION_ENDED';
    const CHAT_CHANGED = types.CHAT_CHANGED || 'CHAT_CHANGED';
    const CHARACTER_MESSAGE_RENDERED =
        types.CHARACTER_MESSAGE_RENDERED || 'CHARACTER_MESSAGE_RENDERED';

    addSettings();
    renderAll();

    eventSource.on(MESSAGE_RECEIVED, onMessageDone);
    eventSource.on(GENERATION_ENDED, onMessageDone);
    eventSource.on(CHAT_CHANGED, renderAll);
    eventSource.on(CHARACTER_MESSAGE_RENDERED, renderAll);

    console.log(`[${MODULE}] loaded`);
});