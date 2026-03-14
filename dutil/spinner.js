if (window._hxb_load_h) htmx.off('htmx:load', window._hxb_load_h);

const upd_favi = () => $('[rel="icon"]').attr('href', $('.spinner').length ? '/assets/loadicon.ico' : '/assets/favicon.ico');

const _done = new Set();
htmx.on('htmx:wsAfterMessage', () =>
    $('[data-sm]').each((_, el) => { if ($(el).find('.time-el').text().trim()) _done.add(el.id); })
);

const watch = s => {
    const $s=$(s), id=$s.closest('[data-sm]').attr('id');
    if (!id) return;
    if (_done.has(id)) { $s.remove(); upd_favi(); return; }
    const h = e => { if ($(e.detail.elt).is(`#${id}`)) { htmx.off('htmx:load', h); $s.remove(); upd_favi(); } };
    htmx.on('htmx:load', h);
};

window._hxb_load_h = e => { const $el=$(e.detail.elt); if ($el.is('[data-sm]')) $el.find('.spinner').each((_, s) => watch(s)); };
htmx.on('htmx:load', window._hxb_load_h);
$('#dialog_container').find('.spinner').each((_, s) => watch(s));