import ce, { useState as x, useMemo as de, useEffect as V, useRef as ue } from "react";
var M = { exports: {} }, $ = {};
/**
 * @license React
 * react-jsx-runtime.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var re;
function pe() {
  if (re) return $;
  re = 1;
  var r = Symbol.for("react.transitional.element"), c = Symbol.for("react.fragment");
  function o(p, d, u) {
    var k = null;
    if (u !== void 0 && (k = "" + u), d.key !== void 0 && (k = "" + d.key), "key" in d) {
      u = {};
      for (var b in d)
        b !== "key" && (u[b] = d[b]);
    } else u = d;
    return d = u.ref, {
      $$typeof: r,
      type: p,
      key: k,
      ref: d !== void 0 ? d : null,
      props: u
    };
  }
  return $.Fragment = c, $.jsx = o, $.jsxs = o, $;
}
var z = {};
/**
 * @license React
 * react-jsx-runtime.development.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
var ae;
function me() {
  return ae || (ae = 1, process.env.NODE_ENV !== "production" && (function() {
    function r(t) {
      if (t == null) return null;
      if (typeof t == "function")
        return t.$$typeof === i ? null : t.displayName || t.name || null;
      if (typeof t == "string") return t;
      switch (t) {
        case E:
          return "Fragment";
        case l:
          return "Profiler";
        case a:
          return "StrictMode";
        case N:
          return "Suspense";
        case w:
          return "SuspenseList";
        case J:
          return "Activity";
      }
      if (typeof t == "object")
        switch (typeof t.tag == "number" && console.error(
          "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
        ), t.$$typeof) {
          case f:
            return "Portal";
          case j:
            return (t.displayName || "Context") + ".Provider";
          case s:
            return (t._context.displayName || "Context") + ".Consumer";
          case h:
            var n = t.render;
            return t = t.displayName, t || (t = n.displayName || n.name || "", t = t !== "" ? "ForwardRef(" + t + ")" : "ForwardRef"), t;
          case F:
            return n = t.displayName || null, n !== null ? n : r(t.type) || "Memo";
          case Y:
            n = t._payload, t = t._init;
            try {
              return r(t(n));
            } catch {
            }
        }
      return null;
    }
    function c(t) {
      return "" + t;
    }
    function o(t) {
      try {
        c(t);
        var n = !1;
      } catch {
        n = !0;
      }
      if (n) {
        n = console;
        var m = n.error, g = typeof Symbol == "function" && Symbol.toStringTag && t[Symbol.toStringTag] || t.constructor.name || "Object";
        return m.call(
          n,
          "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
          g
        ), c(t);
      }
    }
    function p(t) {
      if (t === E) return "<>";
      if (typeof t == "object" && t !== null && t.$$typeof === Y)
        return "<...>";
      try {
        var n = r(t);
        return n ? "<" + n + ">" : "<...>";
      } catch {
        return "<...>";
      }
    }
    function d() {
      var t = A.A;
      return t === null ? null : t.getOwner();
    }
    function u() {
      return Error("react-stack-top-frame");
    }
    function k(t) {
      if (D.call(t, "key")) {
        var n = Object.getOwnPropertyDescriptor(t, "key").get;
        if (n && n.isReactWarning) return !1;
      }
      return t.key !== void 0;
    }
    function b(t, n) {
      function m() {
        Z || (Z = !0, console.error(
          "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
          n
        ));
      }
      m.isReactWarning = !0, Object.defineProperty(t, "key", {
        get: m,
        configurable: !0
      });
    }
    function y() {
      var t = r(this.type);
      return H[t] || (H[t] = !0, console.error(
        "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
      )), t = this.props.ref, t !== void 0 ? t : null;
    }
    function O(t, n, m, g, P, R, B, G) {
      return m = R.ref, t = {
        $$typeof: C,
        type: t,
        key: n,
        props: R,
        _owner: P
      }, (m !== void 0 ? m : null) !== null ? Object.defineProperty(t, "ref", {
        enumerable: !1,
        get: y
      }) : Object.defineProperty(t, "ref", { enumerable: !1, value: null }), t._store = {}, Object.defineProperty(t._store, "validated", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: 0
      }), Object.defineProperty(t, "_debugInfo", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: null
      }), Object.defineProperty(t, "_debugStack", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: B
      }), Object.defineProperty(t, "_debugTask", {
        configurable: !1,
        enumerable: !1,
        writable: !0,
        value: G
      }), Object.freeze && (Object.freeze(t.props), Object.freeze(t)), t;
    }
    function T(t, n, m, g, P, R, B, G) {
      var v = n.children;
      if (v !== void 0)
        if (g)
          if (Q(v)) {
            for (g = 0; g < v.length; g++)
              S(v[g]);
            Object.freeze && Object.freeze(v);
          } else
            console.error(
              "React.jsx: Static children should always be an array. You are likely explicitly calling React.jsxs or React.jsxDEV. Use the Babel transform instead."
            );
        else S(v);
      if (D.call(n, "key")) {
        v = r(t);
        var I = Object.keys(n).filter(function(ie) {
          return ie !== "key";
        });
        g = 0 < I.length ? "{key: someKey, " + I.join(": ..., ") + ": ...}" : "{key: someKey}", te[v + g] || (I = 0 < I.length ? "{" + I.join(": ..., ") + ": ...}" : "{}", console.error(
          `A props object containing a "key" prop is being spread into JSX:
  let props = %s;
  <%s {...props} />
React keys must be passed directly to JSX without using spread:
  let props = %s;
  <%s key={someKey} {...props} />`,
          g,
          v,
          I,
          v
        ), te[v + g] = !0);
      }
      if (v = null, m !== void 0 && (o(m), v = "" + m), k(n) && (o(n.key), v = "" + n.key), "key" in n) {
        m = {};
        for (var q in n)
          q !== "key" && (m[q] = n[q]);
      } else m = n;
      return v && b(
        m,
        typeof t == "function" ? t.displayName || t.name || "Unknown" : t
      ), O(
        t,
        v,
        R,
        P,
        d(),
        m,
        B,
        G
      );
    }
    function S(t) {
      typeof t == "object" && t !== null && t.$$typeof === C && t._store && (t._store.validated = 1);
    }
    var _ = ce, C = Symbol.for("react.transitional.element"), f = Symbol.for("react.portal"), E = Symbol.for("react.fragment"), a = Symbol.for("react.strict_mode"), l = Symbol.for("react.profiler"), s = Symbol.for("react.consumer"), j = Symbol.for("react.context"), h = Symbol.for("react.forward_ref"), N = Symbol.for("react.suspense"), w = Symbol.for("react.suspense_list"), F = Symbol.for("react.memo"), Y = Symbol.for("react.lazy"), J = Symbol.for("react.activity"), i = Symbol.for("react.client.reference"), A = _.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, D = Object.prototype.hasOwnProperty, Q = Array.isArray, W = console.createTask ? console.createTask : function() {
      return null;
    };
    _ = {
      react_stack_bottom_frame: function(t) {
        return t();
      }
    };
    var Z, H = {}, K = _.react_stack_bottom_frame.bind(
      _,
      u
    )(), ee = W(p(u)), te = {};
    z.Fragment = E, z.jsx = function(t, n, m, g, P) {
      var R = 1e4 > A.recentlyCreatedOwnerStacks++;
      return T(
        t,
        n,
        m,
        !1,
        g,
        P,
        R ? Error("react-stack-top-frame") : K,
        R ? W(p(t)) : ee
      );
    }, z.jsxs = function(t, n, m, g, P) {
      var R = 1e4 > A.recentlyCreatedOwnerStacks++;
      return T(
        t,
        n,
        m,
        !0,
        g,
        P,
        R ? Error("react-stack-top-frame") : K,
        R ? W(p(t)) : ee
      );
    };
  })()), z;
}
var oe;
function fe() {
  return oe || (oe = 1, process.env.NODE_ENV === "production" ? M.exports = pe() : M.exports = me()), M.exports;
}
var e = fe();
const L = ["1Q", "2Q", "3Q", "4Q"], xe = ["月", "火", "水", "木", "金", "土"], be = [
  { id: 1, label: "1限", time: "09:20–11:00" },
  { id: 2, label: "2限", time: "11:10–12:50" },
  { id: 3, label: "3限", time: "13:40–15:20" },
  { id: 4, label: "4限", time: "15:30–17:10" },
  { id: 5, label: "5限", time: "17:20–19:00" }
];
function _e() {
  const [r, c] = x("1Q"), [o, p] = x(() => se("timetable_settings_v4") ?? {
    days: xe,
    periods: be,
    title: "個人用授業時間割（東京都市大学・4Q制）",
    showTime: !0
  }), d = de(
    () => X(o.days, o.periods),
    [o.days, o.periods]
  ), [u, k] = x(() => {
    const a = se("timetable_data_v4");
    if (a) return a;
    const l = {};
    for (const s of L) l[s] = U(d);
    return l;
  });
  V(() => ne("timetable_data_v4", u), [u]), V(() => ne("timetable_settings_v4", o), [o]);
  const [b, y] = x({ open: !1 }), O = (a, l) => {
    const s = u[r]?.[a]?.[String(l)] ?? null;
    y({ open: !0, day: a, periodId: l, value: s });
  }, T = (a, l) => {
    k((s) => {
      const j = U(s), h = Math.max(...o.periods.map((N) => N.id));
      for (const N of l.days)
        for (let w = 0; w < l.span; w++) {
          const F = l.startPeriodId + w;
          F <= h && (j[r] ??= {}, j[r][N] ??= {}, j[r][N][String(F)] = a);
        }
      return j;
    }), y({ open: !1 });
  }, S = (a) => {
    k((l) => {
      const s = U(l), j = Math.max(...o.periods.map((h) => h.id));
      for (const h of a.days)
        for (let N = 0; N < a.span; N++) {
          const w = a.startPeriodId + N;
          w <= j && s[r]?.[h] && (s[r][h][String(w)] = null);
        }
      return s;
    }), y({ open: !1 });
  }, _ = ue(null), C = () => {
    const a = new Blob([JSON.stringify({ version: 4, settings: o, data: u }, null, 2)], { type: "application/json" }), l = document.createElement("a");
    l.href = URL.createObjectURL(a), l.download = `timetable_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`, l.click();
  }, f = (a) => {
    const l = new FileReader();
    l.onload = () => {
      try {
        const s = JSON.parse(String(l.result));
        if (s.settings && s.data) {
          const j = {};
          for (const h of L)
            j[h] = le(
              X(s.settings.days ?? o.days, s.settings.periods ?? o.periods),
              s.data[h] ?? {}
            );
          p((h) => ({ ...h, ...s.settings ?? {} })), k(j), alert("読込が完了しました。");
        } else
          alert("不正なファイルです。");
      } catch {
        alert("読込に失敗しました。");
      }
    }, l.readAsText(a);
  }, E = () => window.print();
  return /* @__PURE__ */ e.jsxs("div", { className: "tcu-tt", children: [
    /* @__PURE__ */ e.jsx("style", { children: ye }),
    /* @__PURE__ */ e.jsx("div", { className: "tt-toolbar", children: /* @__PURE__ */ e.jsxs("div", { className: "container tt-toolbar__inner", children: [
      /* @__PURE__ */ e.jsx("h1", { className: "tt-title", children: o.title }),
      /* @__PURE__ */ e.jsx("div", { className: "tt-tabs", role: "tablist", "aria-label": "Quarter tabs", children: L.map((a) => /* @__PURE__ */ e.jsx(
        "button",
        {
          className: `tt-tab ${r === a ? "is-active" : ""}`,
          onClick: () => c(a),
          "aria-pressed": r === a,
          children: a
        },
        a
      )) }),
      /* @__PURE__ */ e.jsxs("div", { className: "tt-actions", children: [
        /* @__PURE__ */ e.jsx("button", { className: "btn-ghost", onClick: C, children: "保存(JSON)" }),
        /* @__PURE__ */ e.jsxs("label", { className: "btn-ghost file-label", children: [
          "読込(JSON)",
          /* @__PURE__ */ e.jsx(
            "input",
            {
              ref: _,
              type: "file",
              accept: "application/json",
              onChange: (a) => {
                const l = a.target.files?.[0];
                l && f(l), a.target.value = "";
              }
            }
          )
        ] }),
        /* @__PURE__ */ e.jsx("button", { className: "btn-ghost", onClick: E, children: "印刷" }),
        /* @__PURE__ */ e.jsx(
          he,
          {
            settings: o,
            setSettings: p,
            setData: k
          }
        )
      ] })
    ] }) }),
    /* @__PURE__ */ e.jsx("main", { className: "container", children: /* @__PURE__ */ e.jsxs("section", { className: "tt-card", children: [
      /* @__PURE__ */ e.jsxs("header", { className: "section-title", children: [
        /* @__PURE__ */ e.jsx("h2", { children: "時間割" }),
        /* @__PURE__ */ e.jsx("span", { className: "small", children: "セルをクリックして編集" })
      ] }),
      /* @__PURE__ */ e.jsx("div", { className: "tt-tablewrap", children: /* @__PURE__ */ e.jsxs("table", { className: "tt-table", children: [
        /* @__PURE__ */ e.jsx("thead", { children: /* @__PURE__ */ e.jsxs("tr", { children: [
          /* @__PURE__ */ e.jsx("th", { className: "tt-th-time", children: "時限" }),
          o.days.map((a) => /* @__PURE__ */ e.jsx("th", { className: "tt-th-day", children: a }, a))
        ] }) }),
        /* @__PURE__ */ e.jsx("tbody", { children: o.periods.map((a) => /* @__PURE__ */ e.jsxs("tr", { children: [
          /* @__PURE__ */ e.jsxs("th", { className: "tt-th-slot", children: [
            /* @__PURE__ */ e.jsx("div", { className: "slot-label", children: a.label }),
            o.showTime && /* @__PURE__ */ e.jsx("div", { className: "slot-time", children: a.time })
          ] }),
          o.days.map((l) => {
            const s = u[r]?.[l]?.[String(a.id)] ?? null;
            return /* @__PURE__ */ e.jsx("td", { className: "tt-td", children: /* @__PURE__ */ e.jsx("button", { className: "tt-cell", onClick: () => O(l, a.id), children: s ? /* @__PURE__ */ e.jsxs("div", { className: "cell-filled", children: [
              /* @__PURE__ */ e.jsx("div", { className: "title", style: { backgroundColor: s.color ?? "var(--chipbg)" }, children: s.title }),
              (s.room || s.teacher) && /* @__PURE__ */ e.jsxs("div", { className: "meta", children: [
                s.room && /* @__PURE__ */ e.jsxs("div", { children: [
                  "教場：",
                  s.room
                ] }),
                s.teacher && /* @__PURE__ */ e.jsxs("div", { children: [
                  "担当：",
                  s.teacher
                ] })
              ] }),
              s.memo && /* @__PURE__ */ e.jsxs("div", { className: "memo", children: [
                "備考：",
                s.memo
              ] })
            ] }) : /* @__PURE__ */ e.jsx("div", { className: "cell-empty", children: "＋ クリックして入力" }) }) }, l);
          })
        ] }, a.id)) })
      ] }) }),
      /* @__PURE__ */ e.jsx("p", { className: "small", style: { marginTop: 10 }, children: "対開講：複数曜日を選択して一括保存／連コマ：連続コマ数を指定" })
    ] }) }),
    b.open && /* @__PURE__ */ e.jsx(
      ge,
      {
        initial: b.value ?? null,
        day: b.day,
        periodId: b.periodId,
        onClose: () => y({ open: !1 }),
        onSaveBulk: T,
        onClearBulk: S,
        days: o.days,
        periods: o.periods
      }
    )
  ] });
}
function he({
  settings: r,
  setSettings: c,
  setData: o
}) {
  const [p, d] = x(!1), [u, k] = x(r.title), [b, y] = x(r.showTime), [O, T] = x(r.days.join(",")), [S, _] = x(ve(r.periods)), C = () => {
    const f = O.split(",").map((a) => a.trim()).filter(Boolean), E = je(S);
    c((a) => ({ ...a, title: u, showTime: b, days: f, periods: E })), o((a) => {
      const l = {};
      for (const s of L)
        l[s] = le(X(f, E), a[s]);
      return l;
    }), d(!1);
  };
  return /* @__PURE__ */ e.jsxs("div", { className: "tt-popover", children: [
    /* @__PURE__ */ e.jsx("button", { className: "btn-primary", onClick: () => d((f) => !f), "aria-expanded": p, children: "⚙ 設定" }),
    p && /* @__PURE__ */ e.jsxs("div", { className: "tt-popover__panel", children: [
      /* @__PURE__ */ e.jsx("h3", { children: "表示設定" }),
      /* @__PURE__ */ e.jsxs("div", { className: "form-grid", children: [
        /* @__PURE__ */ e.jsxs("label", { className: "field", children: [
          /* @__PURE__ */ e.jsx("span", { children: "タイトル" }),
          /* @__PURE__ */ e.jsx("input", { value: u, onChange: (f) => k(f.target.value) })
        ] }),
        /* @__PURE__ */ e.jsxs("label", { className: "field checkbox", children: [
          /* @__PURE__ */ e.jsx("input", { type: "checkbox", checked: b, onChange: (f) => y(f.target.checked) }),
          /* @__PURE__ */ e.jsx("span", { children: "時刻を表示" })
        ] }),
        /* @__PURE__ */ e.jsxs("label", { className: "field", children: [
          /* @__PURE__ */ e.jsx("span", { children: "曜日（カンマ区切り）" }),
          /* @__PURE__ */ e.jsx("input", { value: O, onChange: (f) => T(f.target.value), placeholder: "例：月,火,水,木,金" })
        ] }),
        /* @__PURE__ */ e.jsxs("label", { className: "field", children: [
          /* @__PURE__ */ e.jsx("span", { children: "時限（1行1コマ： 例）1限 09:20–11:00）" }),
          /* @__PURE__ */ e.jsx("textarea", { value: S, onChange: (f) => _(f.target.value) })
        ] })
      ] }),
      /* @__PURE__ */ e.jsxs("div", { className: "actions", children: [
        /* @__PURE__ */ e.jsx("button", { className: "btn-ghost", onClick: () => d(!1), children: "閉じる" }),
        /* @__PURE__ */ e.jsx("button", { className: "btn-primary", onClick: C, children: "反映" })
      ] })
    ] })
  ] });
}
function ge({
  initial: r,
  day: c,
  periodId: o,
  onSaveBulk: p,
  onClearBulk: d,
  onClose: u,
  days: k,
  periods: b
}) {
  const [y, O] = x(r?.title ?? ""), [T, S] = x(r?.room ?? ""), [_, C] = x(r?.teacher ?? ""), [f, E] = x(r?.color ?? "var(--chipbg)"), [a, l] = x(r?.memo ?? ""), [s, j] = x([c]), [h, N] = x(o), [w, F] = x(1), Y = b.length, J = {
    days: s,
    startPeriodId: h,
    span: Math.max(1, Math.min(w, Y))
  };
  return V(() => {
    const i = (A) => A.key === "Escape" && u();
    return window.addEventListener("keydown", i), () => window.removeEventListener("keydown", i);
  }, [u]), /* @__PURE__ */ e.jsx("div", { className: "tt-modal", role: "dialog", "aria-modal": "true", children: /* @__PURE__ */ e.jsxs("div", { className: "tt-dialog", children: [
    /* @__PURE__ */ e.jsxs("header", { className: "tt-dialog__head", children: [
      /* @__PURE__ */ e.jsxs("h2", { children: [
        c,
        " / ",
        o,
        "限 を編集"
      ] }),
      /* @__PURE__ */ e.jsx("button", { className: "tt-close", onClick: u, "aria-label": "閉じる", children: "✕" })
    ] }),
    /* @__PURE__ */ e.jsxs("div", { className: "tt-dialog__body", children: [
      /* @__PURE__ */ e.jsxs("div", { className: "form-grid", children: [
        /* @__PURE__ */ e.jsxs("label", { className: "field", children: [
          /* @__PURE__ */ e.jsx("span", { children: "授業名 *" }),
          /* @__PURE__ */ e.jsx("input", { value: y, onChange: (i) => O(i.target.value), placeholder: "例：電力システム工学A" })
        ] }),
        /* @__PURE__ */ e.jsxs("label", { className: "field", children: [
          /* @__PURE__ */ e.jsx("span", { children: "教場" }),
          /* @__PURE__ */ e.jsx("input", { value: T, onChange: (i) => S(i.target.value), placeholder: "例：2号館 305" })
        ] }),
        /* @__PURE__ */ e.jsxs("label", { className: "field", children: [
          /* @__PURE__ */ e.jsx("span", { children: "担当" }),
          /* @__PURE__ */ e.jsx("input", { value: _, onChange: (i) => C(i.target.value), placeholder: "例：中島 達人" })
        ] }),
        /* @__PURE__ */ e.jsxs("label", { className: "field", children: [
          /* @__PURE__ */ e.jsx("span", { children: "色（背景）" }),
          /* @__PURE__ */ e.jsx("input", { type: "color", value: ke(f), onChange: (i) => E(i.target.value) })
        ] }),
        /* @__PURE__ */ e.jsxs("label", { className: "field", children: [
          /* @__PURE__ */ e.jsx("span", { children: "備考" }),
          /* @__PURE__ */ e.jsx("input", { value: a, onChange: (i) => l(i.target.value), placeholder: "例：隔週 / Zoom併用 など" })
        ] })
      ] }),
      /* @__PURE__ */ e.jsxs("div", { className: "tt-bulk", children: [
        /* @__PURE__ */ e.jsx("div", { className: "bulk-head", children: "対象（まとめて反映）" }),
        /* @__PURE__ */ e.jsxs("div", { className: "bulk-grid", children: [
          /* @__PURE__ */ e.jsxs("div", { className: "bulk-days", children: [
            k.map((i) => {
              const A = s.includes(i);
              return /* @__PURE__ */ e.jsx(
                "button",
                {
                  type: "button",
                  onClick: () => j(
                    (D) => D.includes(i) ? D.filter((Q) => Q !== i) : [...D, i]
                  ),
                  className: `chip ${A ? "chip--on" : ""}`,
                  children: i
                },
                i
              );
            }),
            /* @__PURE__ */ e.jsx(
              "button",
              {
                type: "button",
                className: "chip",
                onClick: () => j(["月", "火", "水", "木", "金"]),
                children: "平日"
              }
            ),
            /* @__PURE__ */ e.jsx("button", { type: "button", className: "chip", onClick: () => j([c]), children: "元に戻す" })
          ] }),
          /* @__PURE__ */ e.jsxs("label", { className: "field", children: [
            /* @__PURE__ */ e.jsx("span", { children: "開始時限" }),
            /* @__PURE__ */ e.jsx("select", { value: h, onChange: (i) => N(Number(i.target.value)), children: b.map((i) => /* @__PURE__ */ e.jsxs("option", { value: i.id, children: [
              i.label,
              " ",
              i.time ? `(${i.time})` : ""
            ] }, i.id)) })
          ] }),
          /* @__PURE__ */ e.jsxs("label", { className: "field", children: [
            /* @__PURE__ */ e.jsx("span", { children: "連続コマ数（連コマ）" }),
            /* @__PURE__ */ e.jsx("input", { type: "number", min: 1, max: Y, value: w, onChange: (i) => F(Number(i.target.value)) })
          ] })
        ] }),
        /* @__PURE__ */ e.jsx("p", { className: "small", style: { marginTop: 6 }, children: "例：曜日「月・木」、開始「2限」、連続「1」→ 月2限と木2限に同じ授業（対開講）／ 曜日「月」、連続「2」→ 月3-4限に連コマ" })
      ] })
    ] }),
    /* @__PURE__ */ e.jsxs("footer", { className: "tt-dialog__foot", children: [
      /* @__PURE__ */ e.jsx(
        "button",
        {
          className: "btn-ghost danger",
          onClick: () => d(J),
          title: "上の対象設定に一致するコマを空にします",
          children: "対象コマをまとめて空にする"
        }
      ),
      /* @__PURE__ */ e.jsxs("div", { className: "foot-actions", children: [
        /* @__PURE__ */ e.jsx("button", { className: "btn-ghost", onClick: u, children: "キャンセル" }),
        /* @__PURE__ */ e.jsx(
          "button",
          {
            className: "btn-primary",
            disabled: !y.trim() || s.length === 0,
            onClick: () => p(
              {
                title: y.trim(),
                room: T.trim() || void 0,
                teacher: _.trim() || void 0,
                color: f,
                memo: a.trim() || void 0
              },
              J
            ),
            children: "対象へ一括保存"
          }
        )
      ] })
    ] })
  ] }) });
}
function X(r, c) {
  const o = {};
  for (const p of r) {
    o[p] = {};
    for (const d of c) o[p][String(d.id)] = null;
  }
  return o;
}
function le(r, c) {
  const o = U(r);
  for (const p of Object.keys(c ?? {})) {
    o[p] ??= {};
    for (const d of Object.keys(c[p] ?? {}))
      o[p][d] = c[p][d];
  }
  return o;
}
function U(r) {
  return JSON.parse(JSON.stringify(r));
}
function ne(r, c) {
  localStorage.setItem(r, JSON.stringify(c));
}
function se(r) {
  try {
    const c = localStorage.getItem(r);
    return c ? JSON.parse(c) : null;
  } catch {
    return null;
  }
}
function ve(r) {
  return r.map((c) => `${c.label} ${c.time}`).join(`
`);
}
function je(r) {
  const c = r.split(/\n+/).map((d) => d.trim()).filter(Boolean), o = [];
  let p = 1;
  for (const d of c) {
    const u = d.match(/^(\S+)(?:\s+(.+))?$/);
    u && o.push({ id: p++, label: u[1], time: u[2] ?? "" });
  }
  return o.length ? o : [{ id: 1, label: "1限", time: "" }];
}
function ke(r) {
  return r?.startsWith("var(") ? "#E6F2FF" : r || "#E6F2FF";
}
const ye = `
.tcu-tt{
  /* 参照デザインのトークンを踏襲しつつ、都市大ブルーで上書き */
  --brand:#005BAC;
  --brand2:#2F8AE6;
  --radius:18px;
  --shadow:0 12px 28px rgba(0,0,0,.12);
  --card:var(--card);
  --stroke:var(--stroke);
  --text:var(--text);
  --muted:var(--muted);
}
.tcu-tt .tt-toolbar{
  position:sticky;top:0;z-index:20;border-bottom:1px solid var(--stroke);
  backdrop-filter:saturate(180%) blur(8px);
  background:color-mix(in oklab,var(--card) 86%, transparent);
}
.tcu-tt .tt-toolbar__inner{display:flex;align-items:center;gap:16px;padding:10px 0}
.tcu-tt .tt-title{font-size:clamp(18px,2.2vw,22px);font-weight:800;margin:0;letter-spacing:.01em}
.tcu-tt .tt-tabs{margin-left:auto;display:flex;gap:8px}
.tcu-tt .tt-tab{
  border:1px solid var(--stroke);border-radius:999px;padding:.45rem .8rem;font-size:13px;
  background:var(--card);color:var(--text);transition:.18s ease;
}
.tcu-tt .tt-tab:hover{border-color:var(--brand)}
.tcu-tt .tt-tab.is-active{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#041016;border-color:transparent;font-weight:700}
.tcu-tt .tt-actions{display:flex;gap:10px;margin-left:10px}
.tcu-tt .file-label{position:relative;overflow:hidden}
.tcu-tt .file-label input{position:absolute;inset:0;opacity:0;cursor:pointer}

.tcu-tt .tt-card{
  background:linear-gradient(var(--card),var(--card)) padding-box;
  border:1px solid var(--stroke);border-radius:var(--radius);box-shadow:var(--shadow);padding:18px;margin:18px 0;
}
.tcu-tt .tt-tablewrap{overflow:auto;border-radius:14px;border:1px solid var(--stroke)}
.tcu-tt .tt-table{width:100%;border-collapse:separate;border-spacing:0;background:var(--card)}
.tcu-tt .tt-th-time,.tcu-tt .tt-th-day{
  position:sticky;top:0;z-index:1;padding:12px;text-align:left;
  background:color-mix(in oklab,var(--card) 90%, #fff 10%);
  border-bottom:1px solid var(--stroke);
}
.tcu-tt .tt-th-day{text-align:center;min-width:9rem}
.tcu-tt .tt-th-slot{
  background:color-mix(in oklab,var(--card) 94%, #fff 6%);
  border-top:1px solid var(--stroke);padding:12px;vertical-align:top;width:10.5rem
}
.tcu-tt .slot-label{font-weight:700}
.tcu-tt .slot-time{font-size:12px;color:var(--muted)}
.tcu-tt .tt-td{border-top:1px solid var(--stroke);vertical-align:top}
.tcu-tt .tt-cell{
  width:100%;text-align:left;padding:12px;min-height:88px;cursor:pointer;border:0;background:transparent;
  transition:background .15s ease, transform .08s ease; border-radius:12px;
}
.tcu-tt .tt-cell:hover{background:color-mix(in oklab,var(--brand) 8%, transparent);transform:translateY(-1px)}
.tcu-tt .tt-cell:focus-visible{outline:2px solid color-mix(in oklab,var(--brand),white 18%);outline-offset:2px}
.tcu-tt .cell-empty{font-size:13px;color:color-mix(in oklab,var(--brand),#000 30%)}
.tcu-tt .cell-filled .title{
  display:inline-block;padding:2px 8px;border-radius:8px;font-weight:700;color:color-mix(in oklab,var(--text),white 10%);
  box-shadow:0 1px 0 rgba(0,0,0,.04) inset;
}
.tcu-tt .cell-filled .meta{margin-top:6px;font-size:12px;color:var(--muted);line-height:1.6}
.tcu-tt .cell-filled .memo{margin-top:4px;font-size:12px;color:color-mix(in oklab,var(--muted),#000 15%)}

/* ポップオーバー（設定） */
.tcu-tt .tt-popover{position:relative}
.tcu-tt .tt-popover__panel{
  position:absolute;right:0;top:calc(100% + 8px);
  width:min(32rem,95vw);background:var(--card);border:1px solid var(--stroke);border-radius:16px;
  box-shadow:var(--shadow);padding:16px;z-index:30;
}
.tcu-tt .tt-popover__panel h3{margin:0 0 10px;color:var(--text)}
.tcu-tt .form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.tcu-tt .form-grid .field{display:flex;flex-direction:column;gap:6px}
.tcu-tt .form-grid .field > span{font-size:13px;color:var(--muted)}
.tcu-tt .form-grid input,.tcu-tt .form-grid select,.tcu-tt .form-grid textarea{
  border:1px solid var(--stroke);border-radius:12px;background:var(--card);color:var(--text);
  padding:.6rem .75rem;font-size:14px
}
.tcu-tt .form-grid textarea{height:150px}
.tcu-tt .form-grid .checkbox{flex-direction:row;align-items:center;gap:8px}
.tcu-tt .actions{display:flex;justify-content:flex-end;gap:10px;margin-top:10px}
.tcu-tt .btn-primary{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#041016;font-weight:700;border-radius:14px;padding:.7rem 1rem;border:0}
.tcu-tt .btn-ghost{border:1px solid var(--stroke);border-radius:14px;padding:.7rem 1rem;background:transparent}
.tcu-tt .btn-ghost.danger{color:#b42318;border-color:color-mix(in oklab,#b42318,#000 25%)}

/* モーダル */
.tcu-tt .tt-modal{position:fixed;inset:0;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;padding:18px;z-index:40}
.tcu-tt .tt-dialog{width:min(720px,96vw);background:var(--card);border:1px solid var(--stroke);border-radius:20px;box-shadow:var(--shadow)}
.tcu-tt .tt-dialog__head{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--stroke)}
.tcu-tt .tt-dialog__head h2{margin:0;font-size:16px}
.tcu-tt .tt-close{border:1px solid var(--stroke);border-radius:10px;background:transparent;padding:.3rem .55rem}
.tcu-tt .tt-dialog__body{padding:16px}
.tcu-tt .tt-dialog__foot{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-top:1px solid var(--stroke)}
.tcu-tt .foot-actions{display:flex;gap:10px}

/* 対開講UI */
.tcu-tt .tt-bulk{margin-top:10px;border:1px dashed var(--stroke);border-radius:14px;padding:12px;background:color-mix(in oklab,var(--card) 96%, transparent)}
.tcu-tt .bulk-head{font-weight:700;margin-bottom:10px}
.tcu-tt .bulk-grid{display:grid;grid-template-columns:1.4fr .8fr .8fr;gap:12px}
.tcu-tt .bulk-days{display:flex;flex-wrap:wrap;gap:8px}
.tcu-tt .chip{border:1px solid var(--stroke);border-radius:999px;padding:.35rem .7rem;font-size:12px;background:var(--card)}
.tcu-tt .chip--on{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#041016;border-color:transparent;font-weight:700}

/* レスポンシブ */
@media (max-width:900px){
  .tcu-tt .form-grid{grid-template-columns:1fr}
  .tcu-tt .bulk-grid{grid-template-columns:1fr}
}
`;
export {
  _e as default
};
