(function() {
    // --- Serialization ---
    const _xhr_fields = ['status', 'statusText', 'responseText', 'responseURL'];
    const _ser_xhr = xhr => Object.fromEntries(_xhr_fields.map(k => [k, xhr[k]]));
    const _ser_elt = e => ({id: e.id, tagName: e.tagName.toLowerCase(), outerHTML: e.outerHTML});
    const _ser_detail = d => ({
        ...(d.xhr ? {xhr: _ser_xhr(d.xhr)} : {}),
        successful: d.successful, failed: d.failed,
        pathInfo: d.pathInfo ? {requestPath: d.pathInfo.requestPath, finalRequestPath: d.pathInfo.finalRequestPath} : undefined
    });

    // --- Result helpers ---
    const _ok = v => ({success: v}), _err = v => ({error: v});
    const _push = (idx, result, full_response, detail=null) =>
        pushData(idx, full_response && detail ? {...result, response: _ser_detail(detail)} : result);

    // --- DOM helpers ---
    const _elt = sel => { const e = htmx.find(sel); if (!e) throw new Error(`Not found: ${sel}`); return e; };
    const _resolve_root = args => {
        if (args.length < 2) return [null, args[0]];
        const root = htmx.find(args[0]);
        if (!root) throw new Error(`Root not found: ${args[0]}`);
        return [root, args[1]];
    };

    // --- Factory for simple sync handlers ---
    const _sync = fn => ({idx, args}) => {
        try { pushData(idx, _ok(fn(args))); }
        catch(e) { pushData(idx, _err(String(e))); }
    };

    // --- Managed listener set (for async handlers) ---
    const _listen_set = () => {
        const ls = [];
        return {
            on: (evt, fn) => { ls.push([evt, fn]); htmx.on(evt, fn); },
            cleanup: result => { ls.forEach(([e, f]) => htmx.off(e, f)); return result; }
        };
    };

    // --- Handlers ---
    const _handlers = {
        // Sync: fire-and-forget
        eval:         ({idx, args, full_response}) => _push(idx, _ok((0, eval)(args[0])), full_response),
        trigger:      _sync(a => { htmx.trigger(_elt(a[0]), a[1], a[2] ?? {}); return true; }),
        process:      _sync(a => { htmx.process(_elt(a[0])); return true; }),
        remove:       _sync(a => { htmx.remove(_elt(a[0]), a[1] ?? undefined); return true; }),
        addClass:     _sync(a => { htmx.addClass(_elt(a[0]), a[1], a[2] ?? undefined); return true; }),
        removeClass:  _sync(a => { htmx.removeClass(_elt(a[0]), a[1], a[2] ?? undefined); return true; }),
        toggleClass:  _sync(a => { htmx.toggleClass(_elt(a[0]), a[1]); return true; }),
        takeClass:    _sync(a => { htmx.takeClass(_elt(a[0]), a[1]); return true; }),
        logAll:       _sync(() => { htmx.logAll(); return true; }),
        logNone:      _sync(() => { htmx.logNone(); return true; }),
        parseInterval:_sync(a => ({result: htmx.parseInterval(a[0])})),
        values:       _sync(a => ({result: htmx.values(_elt(a[0]), a[1])})),
        get_config:   _sync(a => ({key: a[0], value: htmx.config[a[0]]})),
        set_config:   _sync(a => { htmx.config[a[0]] = a[1]; return true; }),

        // Sync: element queries (custom error messages for not-found)
        find: ({idx, args, full_response}) => {
            const [root, sel] = _resolve_root(args);
            const e = root ? htmx.find(root, sel) : htmx.find(sel);
            if (!e) return pushData(idx, _err(`No element found: ${sel}`));
            _push(idx, _ok(_ser_elt(e)), full_response);
        },
        findAll: _sync(a => {
            const [root, sel] = _resolve_root(a);
            const els = [...htmx.findAll(...(root ? [root, sel] : [sel]))];
            return {count: els.length, items: els.map(_ser_elt)};
        }),
        closest: _sync(a => {
            const e = htmx.closest(_elt(a[0]), a[1]);
            if (!e) throw new Error(`No ancestor found: ${a[1]}`);
            return _ser_elt(e);
        }),

        // Async: ajax (full round-trip, discriminate by unique path if present)
        ajax: ({idx, args, full_response}) => {
            const [verb, path, context, by_path] = args;
            const ctx = typeof context === 'string' ? {target: context} : {...(context ?? {})};
            if (!by_path && !ctx.source) {
                ctx.source = document.createElement('div');
                ctx.source.style.display = 'none';
                document.body.appendChild(ctx.source);
            }
            if (!ctx?.target) ctx.swap = 'none';
            const matches = e => by_path
                ? e.detail.requestConfig?.path === path
                : e.detail.elt === ctx.source;
            const src_cleanup = () => { if (!by_path && ctx.source?.isConnected) ctx.source.remove(); };
            const {on, cleanup} = _listen_set();
            const done = result => { src_cleanup(); pushData(idx, cleanup(result)); };
            const success_evt = by_path ? 'htmx:afterSettle' : 'htmx:afterRequest';
            on(success_evt, e => {
                if (!matches(e)) return;
                if (by_path || e.detail.successful) {
                    done(full_response && e.detail ? {success: true, response: _ser_detail(e.detail)} : _ok(true));
                } else {
                    done(_err(`HTTP ${e.detail.xhr?.status}: ${e.detail.xhr?.responseText || e.detail.xhr?.statusText}`));
                }
            });
            for (const evt of ['htmx:onLoadError','htmx:targetError','htmx:swapError','htmx:invalidPath','htmx:responseError']) {
                on(evt, e => { if (matches(e)) done(_err(`${evt.replace('htmx:','')}: ${e.detail.error ?? e.detail.target ?? ''}`)); });
            }
            htmx.ajax(verb, path, ctx).catch(err => done(_err(err?.message ?? String(err))));
        },

        // Async: swap (local, no server)
        swap: ({idx, args, full_response}) => {
            const [target, content, swapSpec, swapOptions] = args;
            const {on, cleanup} = _listen_set();
            on('htmx:swapError', e => {
                if (e.detail?.idx !== idx) return;
                pushData(idx, cleanup(_err('htmx:swapError')));
            });
            const opts = {...(swapOptions ?? {}),
                afterSettleCallback: () => _push(idx, cleanup(_ok({swapped: true})), full_response),
                eventInfo: {idx}};
            try {
                if (swapSpec?.swapDelay > 0 && typeof target === 'string' && !htmx.find(target))
                    throw new Error(`Target not found: ${target}`);
                htmx.swap(target, content, swapSpec ?? {swapStyle: 'innerHTML'}, opts);
            } catch(e) { pushData(idx, cleanup(_err(String(e)))); }
        },


        // Async: trigger_ex (trigger + wait for htmx lifecycle events)
        trigger_ex: ({idx, args, full_response}) => {
            const [elt, name, detail, wait_for] = args;
            const err_evts = ['htmx:sendError','htmx:targetError','htmx:swapError','htmx:onLoadError','htmx:timeout','htmx:responseError'];
            const ok_evts = wait_for ? wait_for.split(',').map(s => s.trim()) : [];
            const {on, cleanup} = _listen_set();
            const mine = e => e.detail?.requestConfig?.triggeringEvent?.detail?._hxb === idx;
            const make = (evt, is_err) => on(evt, e => {
                if (!mine(e)) return;
                const r = full_response && e.detail;
                pushData(idx, cleanup(is_err
                    ? (r ? {error: evt, response: _ser_detail(e.detail)} : _err(evt))
                    : (r ? {success: true, response: _ser_detail(e.detail)} : _ok(true))));
            });
            err_evts.forEach(e => make(e, true));
            ok_evts.forEach(e => make(e, false));
            htmx.trigger(_elt(elt), name, {...(detail ?? {}), _hxb: idx});
        },
    };

    // --- Bridge entry point ---
    if (window._hx_bridge) document.body.removeEventListener('hx_bridge', window._hx_bridge);
    window._hx_bridge = e => {
        const {method, idx} = e.detail;
        const h = _handlers[method];
        if (!h) return pushData(idx, _err(`Unknown method: ${method}`));
        try { h(e.detail); } catch(err) { pushData(idx, _err(String(err))); }
    };
    document.body.addEventListener('hx_bridge', window._hx_bridge);
})();