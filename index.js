/**
 * Message Provider Tag
 * 生成完成时把当前「连接配置」名字写入消息 extra，并显示在角色名旁。
 * 只显示已写入的记录；没有记录的旧楼不显示，也不会拿当前连接去顶替。
 */

const MODULE = 'message-provider-tag';
const EXTRA_KEY = 'tt_provider';

function getSettings() {
    const ctx = SillyTavern.getContext();
    const root = ctx.extensionSettings || window.extension_settings || {};
    if (!root[MODULE]) {
        root[MODULE] = {
            enabled: true,
            showOnHeader: true,
        };
    }
    return root[MODULE];
}

function getConnectionProfileName() {
    try {
        const ext =
            (SillyTavern.getContext().extensionSettings || window.extension_settings || {});
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

function stampProvider($mes, name) {
    if (!$mes || !$mes.length) return;

    $mes.find('.tt-provider-tag').remove();
    if (!name) return;

    const settings = getSettings();
    if (!settings.enabled) return;

    const html = `<span class="tt-provider-tag"> (${escapeHtml(name)})</span>`;
    const $model = $mes.find('.tt-model-tag').first();
    if ($model.length) {
        if (!$model.parent().hasClass('tt-model-wrap')) {
            $model.wrap('<span class="tt-model-wrap"></span>');
        }
        $model.after(html);
        return;
    }

    const $host = $mes.find('.mes_block > .ch_name, .mes_block .name_date, .ch_name').first();
    if ($host.length) {
        $host.append(html);
    }
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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
                    生成完成时写入当前「连接配置」名称。旧楼没有记录则不显示，不会用当前连接顶替。
                </small>
            </div>
        </div>
    </div>`;

    $('#extensions_settings').append(html);
    $('#mpt_enabled').on('input', function () {
        getSettings().enabled = !!$(this).prop('checked');
        try {
            const ctx = SillyTavern.getContext();
            if (typeof ctx.saveSettingsDebounced === 'function') ctx.saveSettingsDebounced();
            else if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
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