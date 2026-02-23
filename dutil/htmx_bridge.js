(function() {
    const _xhr_fields = ['status', 'statusText', 'responseText', 'responseURL'];
    const _ser_xhr = xhr => Object.fromEntries(_xhr_fields.map(k => [k, xhr[k]]));
    const _ser_detail = d => ({
        ...(d.xhr ? {xhr: _ser_xhr(d.xhr)} : {}),
        successful: d.successful, failed: d.failed,
        pathInfo: d.pathInfo ? {requestPath: d.pathInfo.requestPath, finalRequestPath: d.pathInfo.finalRequestPath} : undefined
    });

    const _handlers = {
        ajax: ({idx, args, full_response}) => {
            let [verb, path, context] = args;
            const handler = e => {
                const res = {success: true};
                if (full_response) res.response = _ser_detail(e.detail);
                pushData(idx, res);
            };
            htmx.on('htmx:afterRequest', handler);
            htmx.ajax(verb, path, context ?? {})
                .catch(err => pushData(idx, {error: String(err)}))
                .finally(() => htmx.off('htmx:afterRequest', handler));
        },
        swap: ({idx, args, full_response}) => {
            try {
                const [target, content, swapSpec, swapOptions] = args;
                htmx.swap(target, content, swapSpec ?? {swapStyle: 'innerHTML'}, swapOptions ?? {});
                const res = {success: true};
                if (full_response) res.response = null;
                pushData(idx, res);
            } catch(e) { pushData(idx, {error: String(e)}); }
        },
        remove: ({idx, args}) => { try { htmx.remove(htmx.find(args[0]), args[1] ?? undefined); pushData(idx, {success: true}); } catch(e) { pushData(idx, {error: String(e)}); } },
        addClass: ({idx, args}) => { try { htmx.addClass(htmx.find(args[0]), args[1], args[2] ?? undefined); pushData(idx, {success: true}); } catch(e) { pushData(idx, {error: String(e)}); } },
        removeClass: ({idx, args}) => { try { htmx.removeClass(htmx.find(args[0]), args[1], args[2] ?? undefined); pushData(idx, {success: true}); } catch(e) { pushData(idx, {error: String(e)}); } },
        toggleClass: ({idx, args}) => { try { htmx.toggleClass(htmx.find(args[0]), args[1]); pushData(idx, {success: true}); } catch(e) { pushData(idx, {error: String(e)}); } },
        takeClass: ({idx, args}) => { try { htmx.takeClass(htmx.find(args[0]), args[1]); pushData(idx, {success: true}); } catch(e) { pushData(idx, {error: String(e)}); } },
        trigger: ({idx, args}) => { try { htmx.trigger(htmx.find(args[0]), args[1], args[2] ?? {}); pushData(idx, {success: true}); } catch(e) { pushData(idx, {error: String(e)}); } },
        process: ({idx, args}) => { try { htmx.process(htmx.find(args[0])); pushData(idx, {success: true}); } catch(e) { pushData(idx, {error: String(e)}); } },
        values: ({idx, args}) => { try { pushData(idx, {success: {result: htmx.values(htmx.find(args[0]), args[1])}}); } catch(e) { pushData(idx, {error: String(e)}); } },
        parseInterval:({idx, args}) => { try { pushData(idx, {success: {result: htmx.parseInterval(args[0])}}); } catch(e) { pushData(idx, {error: String(e)}); } },
        logAll: ({idx})       => { try { htmx.logAll(); pushData(idx, {success: true}); } catch(e) { pushData(idx, {error: String(e)}); } },
        logNone: ({idx})       => { try { htmx.logNone(); pushData(idx, {success: true}); } catch(e) { pushData(idx, {error: String(e)}); } },
        find: ({idx, args}) => { try { const e = htmx.find(args[0]); if (!e) return pushData(idx, {error: `No element found: ${args[0]}`}); pushData(idx, {success: {id: e.id, tagName: e.tagName.toLowerCase(), outerHTML: e.outerHTML}}); } catch(e) { pushData(idx, {error: String(e)}); } },
        findAll: ({idx, args}) => { try { const els = [...htmx.findAll(args[0])]; pushData(idx, {success: {count: els.length, items: els.map(e => ({id: e.id, tagName: e.tagName.toLowerCase(), outerHTML: e.outerHTML}))}}); } catch(e) { pushData(idx, {error: String(e)}); } },
        closest: ({idx, args}) => { try { const e = htmx.closest(htmx.find(args[0]), args[1]); if (!e) return pushData(idx, {error: `No ancestor found: ${args[1]}`}); pushData(idx, {success: {id: e.id, tagName: e.tagName.toLowerCase(), outerHTML: e.outerHTML}}); } catch(e) { pushData(idx, {error: String(e)}); } },
    };

    if (window._htmx_bridge) document.body.removeEventListener('htmx_bridge', window._htmx_bridge);
    window._htmx_bridge = e => {
        const payload = e.detail;
        const handler = _handlers[payload.method];
        if (!handler) return pushData(payload.idx, {error: `Unknown method: ${payload.method}`});
        handler(payload);
    };
    document.body.addEventListener('htmx_bridge', window._htmx_bridge);
})();