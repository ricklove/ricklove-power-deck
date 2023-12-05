// ▄████████ ███    █▄     ▄████████    ▄█    █▄    ▄██   ▄           ▄████████    ▄███████▄    ▄███████▄
// ███    ███ ███    ███   ███    ███   ███    ███   ███   ██▄        ███    ███   ███    ███   ███    ███
// ███    █▀  ███    ███   ███    █▀    ███    ███   ███▄▄▄███        ███    ███   ███    ███   ███    ███
// ███        ███    ███   ███         ▄███▄▄▄▄███▄▄ ▀▀▀▀▀▀███        ███    ███   ███    ███   ███    ███
// ███        ███    ███ ▀███████████ ▀▀███▀▀▀▀███▀  ▄██   ███      ▀███████████ ▀█████████▀  ▀█████████▀
// ███    █▄  ███    ███          ███   ███    ███   ███   ███        ███    ███   ███          ███
// ███    ███ ███    ███    ▄█    ███   ███    ███   ███   ███        ███    ███   ███          ███
// ████████▀  ████████▀   ▄████████▀    ███    █▀     ▀█████▀         ███    █▀   ▄████▀       ▄████▀

// library/ricklove/my-cushy-deck/src/test.tsx
import React from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var TestComponentWrapper = ({ value, onChange }) => {
  return /* @__PURE__ */ jsx(TestComponent, { value: value ?? {}, onChange });
};
var TestComponent = (props) => {
  const { value } = props;
  const change = (v) => {
    props.onChange({ ...props.value, ...v });
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("div", { children: "test component" }),
    /* @__PURE__ */ jsx(InteractiveTest, { ...props, onChange: change }),
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("div", { children: "This is a react component:" }),
      /* @__PURE__ */ jsx("div", { className: "flex-row flex-wrap", children: /* @__PURE__ */ jsx("div", { className: "w-12 hover:scale-150", children: /* @__PURE__ */ jsx("img", { src: "D:/Projects/ai/CushyStudio/outputs/base_00001_.png" }) }) }),
      value.items?.map((x) => /* @__PURE__ */ jsx(React.Fragment, { children: /* @__PURE__ */ jsx("div", { children: x }) }, x))
    ] })
  ] });
};
var InteractiveTest = (props) => {
  const {
    value: { clickCount = 0 },
    onChange
  } = props;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { children: "Interactive Component" }),
    /* @__PURE__ */ jsxs("div", { onClick: () => onChange({ clickCount: clickCount + 1 }), children: [
      "value: ",
      clickCount
    ] }),
    /* @__PURE__ */ jsx("div", { children: "Interactive Component END" })
  ] });
};
export {
  TestComponentWrapper
};
