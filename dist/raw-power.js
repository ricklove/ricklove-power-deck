// ▄████████ ███    █▄     ▄████████    ▄█    █▄    ▄██   ▄           ▄████████    ▄███████▄    ▄███████▄
// ███    ███ ███    ███   ███    ███   ███    ███   ███   ██▄        ███    ███   ███    ███   ███    ███
// ███    █▀  ███    ███   ███    █▀    ███    ███   ███▄▄▄███        ███    ███   ███    ███   ███    ███
// ███        ███    ███   ███         ▄███▄▄▄▄███▄▄ ▀▀▀▀▀▀███        ███    ███   ███    ███   ███    ███
// ███        ███    ███ ▀███████████ ▀▀███▀▀▀▀███▀  ▄██   ███      ▀███████████ ▀█████████▀  ▀█████████▀
// ███    █▄  ███    ███          ███   ███    ███   ███   ███        ███    ███   ███          ███
// ███    ███ ███    ███    ▄█    ███   ███    ███   ███   ███        ███    ███   ███          ███
// ████████▀  ████████▀   ▄████████▀    ███    █▀     ▀█████▀         ███    █▀   ▄████▀       ▄████▀

// library/ricklove/my-cushy-deck/src/_appState.ts
var PreviewStopError = class extends Error {
  constructor(setFrameIndex) {
    super();
    this.setFrameIndex = setFrameIndex;
  }
};
var getNextActiveNodeIndex = (runtime) => {
  return runtime.workflow.nodes.findLastIndex((x) => !x.disabled) + 1;
};
var disableNodesAfterInclusive = (runtime, iNodeStartDisable) => {
  runtime.workflow.nodes.slice(iNodeStartDisable).forEach((x) => x.disable());
};
var getEnabledNodeNames = (runtime) => {
  return {
    enabledNodes: runtime.workflow.nodes.filter((x) => !x.disabled).map((x) => x.$schema.nameInCushy),
    disabledNodes: runtime.workflow.nodes.filter((x) => x.disabled).map((x) => x.$schema.nameInCushy)
  };
};
var storeInScope = (state, name, kind, value) => {
  const { scopeStack } = state;
  scopeStack[scopeStack.length - 1][name] = value == void 0 ? void 0 : { value, kind };
};
var loadFromScope = (state, name) => {
  const { scopeStack } = state;
  let i = scopeStack.length;
  while (i >= 0) {
    const { value: v } = scopeStack[scopeStack.length - 1][name] ?? {};
    if (v !== void 0) {
      return v;
    }
    i--;
  }
  return void 0;
};

// library/ricklove/my-cushy-deck/src/_maskPrefabs.ts
var createMaskOperation = (op) => op;
var createMaskOperationValue = (op) => op;
var operation_clipSeg = createMaskOperation({
  ui: (form) => ({
    clipSeg: form.groupOpt({
      items: () => ({
        prompt: form.str({ default: `ball` }),
        threshold: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),
        dilation: form.int({ default: 4, min: 0 }),
        blur: form.float({ default: 1, min: 0 })
      })
    })
  }),
  run: ({ runtime, graph }, image, mask, form) => {
    if (form.clipSeg == null) {
      return mask;
    }
    const clipMask = graph.CLIPSeg({
      image,
      text: form.clipSeg.prompt,
      threshold: form.clipSeg.threshold,
      dilation_factor: form.clipSeg.dilation,
      blur: form.clipSeg.blur
    }).outputs.Mask;
    return clipMask;
  }
});
var operation_color = createMaskOperation({
  ui: (form) => ({
    color: form.groupOpt({
      items: () => ({
        intensity: form.int({ default: 0, min: 0, max: 255 })
      })
    })
  }),
  run: ({ runtime, graph }, image, mask, form) => {
    if (form.color == null) {
      return mask;
    }
    const colorMask = graph.ImageColorToMask({
      image,
      color: form.color.intensity
    });
    const dilated = graph.Mask_Dilate_Region({
      masks: colorMask,
      iterations: 1
    }).outputs.MASKS;
    return dilated;
  }
});
var operation_erodeOrDilate = createMaskOperation({
  ui: (form) => ({
    erodeOrDilate: form.intOpt({ min: -64, max: 64 })
  }),
  run: ({ runtime, graph }, image, mask, form) => {
    if (form.erodeOrDilate == null) {
      return mask;
    }
    if (!mask) {
      return mask;
    }
    const maskDilated = form.erodeOrDilate > 0 ? graph.Mask_Dilate_Region({ masks: mask, iterations: form.erodeOrDilate }).outputs.MASKS : form.erodeOrDilate < 0 ? graph.Mask_Erode_Region({ masks: mask, iterations: -form.erodeOrDilate }).outputs.MASKS : mask;
    return maskDilated;
  }
});
var operation_segment = createMaskOperation({
  ui: (form) => ({
    segmentIndex: form.intOpt({ min: 0, max: 10 })
  }),
  run: ({ runtime, graph }, image, mask, form) => {
    if (form.segmentIndex == null) {
      return mask;
    }
    if (!mask) {
      return mask;
    }
    const segs = graph.MaskToSEGS({
      mask
    });
    const segsFilter = graph.ImpactSEGSOrderedFilter({
      segs,
      target: `area(=w*h)`,
      take_start: form.segmentIndex
    });
    mask = graph.SegsToCombinedMask({ segs: segsFilter.outputs.filtered_SEGS }).outputs.MASK;
    return mask;
  }
});
var operation_sam = createMaskOperation({
  ui: (form) => ({
    sam: form.groupOpt({
      items: () => ({
        // prompt: form.str({ default: `ball` }),
        threshold: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),
        detection_hint: form.enum({
          enumName: `Enum_SAMDetectorCombined_detection_hint`,
          default: `center-1`
        }),
        mask_hint_use_negative: form.enum({
          enumName: `Enum_SAMDetectorCombined_mask_hint_use_negative`,
          default: `False`
        })
        // dilation: form.int({ default: 4, min: 0 }),
        // blur: form.float({ default: 1, min: 0 }),
      })
    })
  }),
  run: ({ runtime, graph }, image, mask, form) => {
    if (form.sam == null) {
      return mask;
    }
    if (!mask) {
      return mask;
    }
    const samModel = graph.SAMLoader({
      model_name: `sam_vit_b_01ec64.pth`,
      device_mode: `Prefer GPU`
    });
    const segs = graph.MaskToSEGS({
      mask
    });
    mask = graph.SAMDetectorSegmented({
      segs,
      sam_model: samModel,
      image,
      detection_hint: form.sam.detection_hint,
      mask_hint_use_negative: form.sam.mask_hint_use_negative,
      threshold: form.sam.threshold
    }).outputs.combined_mask;
    return mask;
  }
});
var operation_storeMask = createMaskOperation({
  ui: (form) => ({
    storeMask: form.groupOpt({
      items: () => ({
        name: form.string({ default: `a` })
      })
    })
  }),
  run: (state, image, mask, form) => {
    if (form.storeMask == null) {
      return mask;
    }
    storeInScope(state, form.storeMask.name, `mask`, mask ?? null);
    return mask;
  }
});
var operation_combineMasks = createMaskOperation({
  ui: (form) => ({
    combineMasks: form.groupOpt({
      items: () => ({
        operation: form.selectOne({
          choices: [{ id: `union` }, { id: `intersection` }]
        }),
        a: form.group({
          layout: `V`,
          items: () => ({
            name: form.string({ default: `a` }),
            inverse: form.bool({ default: false })
          })
        }),
        b: form.group({
          layout: `V`,
          items: () => ({
            name: form.string({ default: `b` }),
            inverse: form.bool({ default: false })
          })
        }),
        c: form.groupOpt({
          layout: `V`,
          items: () => ({
            name: form.string({ default: `c` }),
            inverse: form.bool({ default: false })
          })
        }),
        d: form.groupOpt({
          layout: `V`,
          items: () => ({
            name: form.string({ default: `d` }),
            inverse: form.bool({ default: false })
          })
        }),
        e: form.groupOpt({
          layout: `V`,
          items: () => ({
            name: form.string({ default: `d` }),
            inverse: form.bool({ default: false })
          })
        })
      })
    })
  }),
  run: (state, image, mask, form) => {
    if (form.combineMasks == null) {
      return mask;
    }
    mask = void 0;
    const otherMasks = [
      form.combineMasks.a,
      form.combineMasks.b,
      form.combineMasks.c,
      form.combineMasks.d,
      form.combineMasks.e
    ].filter((x) => x).map((x) => x);
    const { graph } = state;
    for (const mItem of otherMasks) {
      const m = loadFromScope(state, mItem.name);
      if (!m) {
        continue;
      }
      const mInverted = !mItem.inverse ? m : graph.InvertMask({ mask: m });
      if (!mask) {
        mask = mInverted;
        continue;
      }
      mask = run_combineMasks(graph, mask, mInverted, form.combineMasks.operation.id);
    }
    return mask;
  }
});
var run_combineMasks = (graph, a, b, operation) => {
  if (operation === `aNotB`) {
    b = graph.InvertMask({ mask: b });
  }
  return graph.ImageToMask$_AS({
    image: graph.Combine_Masks({
      image1: graph.MaskToImage({ mask: a }),
      image2: graph.MaskToImage({ mask: b }),
      op: operation === `union` ? `union (max)` : `intersection (min)`,
      clamp_result: `yes`,
      round_result: `no`
    }).outputs.IMAGE
  }).outputs.MASK;
};
var operations_all = createMaskOperation({
  ui: (form) => ({
    maskOperations: form.list({
      element: () => form.group({
        layout: "V",
        items: () => ({
          ...operation_clipSeg.ui(form),
          ...operation_color.ui(form),
          ...operation_segment.ui(form),
          ...operation_sam.ui(form),
          ...operation_erodeOrDilate.ui(form),
          // ...operation_combineWithMasks.ui(form),
          ...operation_storeMask.ui(form),
          ...operation_combineMasks.ui(form),
          preview: form.inlineRun({})
        })
      })
    })
  }),
  run: (state, image, mask, form) => {
    const { runtime, graph } = state;
    for (const op of form.maskOperations) {
      mask = operation_clipSeg.run(state, image, mask, op);
      mask = operation_color.run(state, image, mask, op);
      mask = operation_segment.run(state, image, mask, op);
      mask = operation_sam.run(state, image, mask, op);
      mask = operation_erodeOrDilate.run(state, image, mask, op);
      mask = operation_storeMask.run(state, image, mask, op);
      mask = operation_combineMasks.run(state, image, mask, op);
      if (op.preview) {
        if (!mask) {
          runtime.output_text(`No mask!`);
          throw new PreviewStopError(void 0);
        }
        const maskAsImage = graph.MaskToImage({ mask });
        const maskPreview = graph.ImageBlend({
          image1: maskAsImage,
          image2: image,
          blend_mode: `normal`,
          blend_factor: 0.5
        });
        graph.PreviewImage({ images: maskPreview });
        throw new PreviewStopError(void 0);
      }
    }
    return mask;
  }
});
var operation_mask = createMaskOperationValue({
  ui: (form) => operations_all.ui(form).maskOperations,
  run: (state, image, mask, form) => operations_all.run(state, image, mask, { maskOperations: form })
});

// library/ricklove/my-cushy-deck/src/optimizer.tsx
import { observer } from "mobx-react-lite";
import { Fragment } from "react";
import { Fragment as Fragment2, jsx, jsxs } from "react/jsx-runtime";
var sortUnknown = (a, b, getValue) => {
  const aValue = getValue(a);
  const bValue = getValue(b);
  if (typeof aValue === `number` && typeof bValue === `number`) {
    return aValue - bValue;
  }
  return `${aValue}`.localeCompare(`${bValue}`);
};
var OptimizerComponent = observer((props) => {
  const {
    widget: {
      state: { value: s }
    }
  } = props;
  const change = (v) => {
    props.widget.state.value = { ...props.widget.state.value, ...v };
  };
  const secondarySortVarPaths = [...new Set(s.images?.flatMap((x) => x.optimizedValues.map((o) => o.varPath)))].filter(
    (x) => x !== s.varPath
  );
  const secondarySortVarPath = s.secondarySortVarPath ?? secondarySortVarPaths[0];
  const imagesSorted = (s.images ?? [])?.slice().sort((a, b) => {
    const s1 = sortUnknown(a, b, (x) => x.value);
    if (s1 || !secondarySortVarPath) {
      return s1;
    }
    return sortUnknown(a, b, (x) => x.optimizedValues.find((o) => o.varPath === secondarySortVarPath)?.value ?? 0);
  });
  const getBucketValue = (x) => typeof x === `number` ? `${Math.floor(x * 20) / 20}` : `${x}`;
  const imageGroupsMap = new Map(imagesSorted.map((x) => [getBucketValue(x.value), []]));
  imagesSorted.forEach((x) => imageGroupsMap.get(getBucketValue(x.value))?.push(x));
  const imageGroups = [...imageGroupsMap.entries()].map(([k, v]) => ({ key: k, items: v }));
  const formatValue = (value) => {
    return `${typeof value === `number` && !Number.isInteger(value) ? value.toFixed?.(2) : value}`;
  };
  return /* @__PURE__ */ jsxs("div", { children: [
    /* @__PURE__ */ jsx("div", { children: secondarySortVarPaths.map((x) => /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsx(
      "div",
      {
        className: `btn btn-sm ${x === secondarySortVarPath ? `btn-outline` : `btn-ghost`}`,
        onClick: () => change({ secondarySortVarPath: x }),
        children: x
      }
    ) }, x)) }),
    imageGroups.map((g) => /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs("div", { className: "flex flex-row flex-wrap", children: [
      /* @__PURE__ */ jsx("div", { className: "text-xs", children: formatValue(g.key) }),
      g.items.map((x, i) => /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs("div", { className: "flex flex-col", children: [
        /* @__PURE__ */ jsx("div", { children: x.imageId && /* @__PURE__ */ jsx(props.extra.ImageUI, { img: x.imageId }) }),
        /* @__PURE__ */ jsx("div", { children: x.optimizedValues?.map((o) => /* @__PURE__ */ jsx(Fragment, { children: /* @__PURE__ */ jsxs("div", { className: "flex flex-row justify-between p-1", children: [
          /* @__PURE__ */ jsx("div", { className: "text-xs break-all", children: o.varPath }),
          /* @__PURE__ */ jsx("div", { className: "text-xs", children: formatValue(o.value) })
        ] }) }, o.varPath)) })
      ] }) }, i))
    ] }) }, g.key))
  ] });
});
var formOptimize = (form, formCreateNonOptional, opts, options) => {
  return (options?.isOptional ? form.groupOpt : form.group)({
    items: () => ({
      _value: formCreateNonOptional(opts),
      _optimize: form.groupOpt({
        layout: `V`,
        items: () => ({
          ...!options?.includeMinMax ? {} : {
            min: formCreateNonOptional(opts),
            max: formCreateNonOptional(opts),
            distribution: form.selectOne({ choices: [{ id: `normal` }, { id: `linear` }] })
          },
          count: form.int({ label: `Iterations`, default: 5, min: 1, max: 100 }),
          run: form.inlineRun({ text: `Run`, className: `self-end` }),
          clear: form.inlineRun({ text: `Clear`, kind: `warning` }),
          results: form.custom({
            Component: OptimizerComponent,
            defaultValue: () => ({})
          })
        })
      })
    })
  });
};
var autoRunsRemaining = 0;
var appOptimized = ({ ui, run }) => {
  return app({
    ui: !ui ? void 0 : (form) => {
      const formBuilderCustom = {
        ...form,
        int: (opts) => formOptimize(form, form.int, opts, { isOptional: false, includeMinMax: true }),
        intOpt: (opts) => formOptimize(form, form.int, opts, { isOptional: true, includeMinMax: true }),
        float: (opts) => formOptimize(form, form.float, opts, { isOptional: false, includeMinMax: true }),
        floatOpt: (opts) => formOptimize(form, form.float, opts, { isOptional: true, includeMinMax: true })
      };
      const uiResult = ui(formBuilderCustom);
      return {
        ...uiResult,
        clearOptimization: form.inlineRun({ kind: `warning` })
      };
    },
    run: async (runtime, formResultsRaw) => {
      const currentDraft = runtime.st.currentDraft;
      const formSerial = runtime.formSerial;
      if (formResultsRaw.clearOptimization) {
        const clearOptimizationRecursive = (n) => {
          if (!n || !(typeof n === `object`)) {
            return;
          }
          if (Array.isArray(n)) {
            for (const x of n) {
              clearOptimizationRecursive(x);
            }
            return;
          }
          if (`_optimize` in n) {
            const nTyped = n;
            nTyped._optimize.values_.results.value = void 0;
            return;
          }
          for (const x of Object.values(n)) {
            clearOptimizationRecursive(x);
          }
        };
        clearOptimizationRecursive(formSerial);
        return;
      }
      const optimizationState = {
        count: 1
      };
      const optimizedValues = [];
      const injectOptimizedValue = (vRaw, varPath) => {
        if (!vRaw || typeof vRaw !== `object`) {
          return vRaw;
        }
        if (Array.isArray(vRaw)) {
          return vRaw.map((x, i) => injectOptimizedValue(x, [...varPath, `${i}`]));
        }
        const v = vRaw;
        if (!(`_optimize` in v)) {
          return Object.fromEntries(Object.entries(v).map(([k, v2]) => [k, injectOptimizedValue(v2, [...varPath, k])]));
        }
        let value = v._value;
        if (!v._optimize) {
          return value;
        }
        const optimize = v._optimize;
        const { min, max, distribution, count, run: runButton } = optimize;
        if (runButton && count && count > optimizationState.count) {
          optimizationState.count = count;
        }
        const generateNormalLikeRandomValue = () => {
          while (true) {
            const z1 = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
            const normalValue = 0.5 * z1 + 0.5;
            if (normalValue >= 0 && normalValue <= 1) {
              return normalValue;
            }
          }
        };
        if (typeof min === `number` && typeof max === `number`) {
          value = min + (max - min) * (distribution === `linear` ? 1 : generateNormalLikeRandomValue());
          if (Number.isInteger(v._value) && Number.isInteger(min) && Number.isInteger(max)) {
            value = Math.round(value);
          }
        }
        optimizedValues.push({ varPath, value });
        return value;
      };
      let formResults = injectOptimizedValue(formResultsRaw, []);
      const navigateToOptimizationVar = (varPath) => {
        let raw = formResultsRaw;
        let res = formResults;
        let ser = formSerial;
        for (const p of varPath) {
          raw = raw?.[p];
          res = res?.[p];
          ser = ser?.[p];
          if (`values_` in ser) {
            ser = ser[`values_`];
          }
          if (`items_` in ser) {
            ser = ser[`items_`];
          }
          if (`elements_` in ser) {
            ser = ser[`elements_`];
          }
        }
        const rawTyped = raw;
        const serTyped = ser;
        return {
          formResultRawValue: rawTyped,
          formResultValue: res,
          formSerialValue: serTyped,
          formSerialOptimizeValue: serTyped._optimize.values_
        };
      };
      for (const o of optimizedValues) {
        const { formResultRawValue, formSerialOptimizeValue } = navigateToOptimizationVar(o.varPath);
        if (formResultRawValue._optimize?.clear) {
          formSerialOptimizeValue.results.value.images = [];
          formSerialOptimizeValue.results.value = { ...formSerialOptimizeValue.results.value };
          return;
        }
      }
      await run(runtime, formResults);
      const generatedOutputIds = runtime.step.generatedImages.map((x) => x?.id ?? ``).filter((x) => x);
      const formResultsObj = JSON.parse(JSON.stringify(formResults));
      optimizedValues.forEach((x) => {
        const { formResultValue, formSerialOptimizeValue, formResultRawValue } = navigateToOptimizationVar(x.varPath);
        if (!formResultRawValue._optimize) {
          return;
        }
        const usedValue = formResultValue;
        const compValue = formSerialOptimizeValue.results.value ?? {};
        compValue.images = [
          ...compValue.images ?? [],
          ...generatedOutputIds.filter((x2) => !compValue.images?.some((y) => y.imageId === x2)).map((x2) => ({
            value: usedValue,
            formResults: formResultsObj,
            optimizedValues: optimizedValues.map((x3) => ({ ...x3, varPath: x3.varPath.join(`.`) })),
            imageId: x2
          }))
        ];
        compValue.varPath = x.varPath.join(`.`);
        formSerialOptimizeValue.results.value = { ...compValue };
      });
      if (autoRunsRemaining > 0) {
        autoRunsRemaining--;
      } else if (optimizationState.count > 1) {
        autoRunsRemaining = optimizationState.count - 1;
      }
      if (autoRunsRemaining > 0) {
        setTimeout(() => {
          currentDraft?.start();
        }, 100);
      }
    }
  });
};

// library/ricklove/my-cushy-deck/src/_random.ts
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  return () => {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return () => {
    let t = a += 1831565813;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var createRandomGenerator = (hash) => {
  const seed = xmur3(hash)();
  const random = mulberry32(seed);
  const randomInt = (minInclusive = 0, maxExclusive = Number.MAX_SAFE_INTEGER) => Math.min(minInclusive + Math.floor(random() * (maxExclusive - minInclusive)), maxExclusive - 1);
  const randomItem = (items) => items[randomInt(0, items.length)];
  return { random, randomInt, randomItem };
};

// library/ricklove/my-cushy-deck/src/humor/_loading.ts
var loadingMessages = `
"Calibrating the hyperdrive with unicorn whispers."
"Translating alien emojis into Earthly emotions."
"Dancing the binary code at the intergalactic disco."
"Inflating space bubbles for zero-gravity pillow fights."
"Convincing black holes to join a sing-along choir."
"Wrestling quantum particles for a game of subatomic tag."
"Tickling extraterrestrial amoebas just for kicks."
"Polishing time-travel mirrors to see reflections from tomorrow."
"Juggling antimatter snowflakes in a cosmic blizzard."
"Babysitting baby star clusters during naptime."
"Bottling the laughter of wormholes for later enjoyment."
"Teaching interstellar crabs the moonwalk."
"Balancing the cosmic equation with rubber duckies."
"Dusting off ancient alien artifacts with laser feather dusters."
"Organizing a parallel universe hide-and-seek tournament."
"Playing hide-and-seek with Schroedinger's cat in a teleportation maze."
"Negotiating peace treaties between parallel universe pandas and robots."
"Training intergalactic snails for the great space race."
"Herding quantum sheep through the fabric of spacetime."
"Reciting Vogon poetry in an attempt to repel invaders."
"Hosting a telepathic tea party for sentient clouds."
"Coaxing malfunctioning robots with lullabies and oil massages."
"Moonwalking on the event horizon of a cosmic donut."
"Conducting a symphony of alien frequencies with a light saber baton."
"Negotiating a trade deal between time-traveling pirates and space ninjas."
"Babbling in an ancient alien dialect to confuse rogue AIs."
"Playing hopscotch on the rings of Saturn with zero-gravity boots."
"Befriending interdimensional dolphins fluent in binary."
"Convincing dark matter to attend a glow-in-the-dark party."
"Practicing levitation with levitating space jellyfish."
"Hitching a ride on a comet while juggling star clusters."
"Teaching a robot dance crew the art of emotional expression."
"Summoning UFOs with interpretative dance rituals."
"Creating crop circles in zero-gravity fields with tractor beams."
"Impersonating a solar flare to confuse sunspot observers."
"Diplomacy with alien diplomats through interpretive dance-offs."
"Playing chess with a sentient nebula and losing gracefully."
"Negotiating peace treaties between time-traveling dinosaurs and future robots."
"Building sandcastles on exoplanets with cosmic ocean waves."
"Conducting an orchestra of alien bug symphonies."
"Teleporting through dimensions with a rainbow-colored pogo stick."
"Translating Morse code messages from extraterrestrial fireflies."
"Attending a zero-gravity synchronized swimming competition."
"Participating in a relay race across the rings of Jupiter."
"Defying gravity by hosting upside-down picnics on magnetic asteroids."
"Exchanging love letters with parallel universe versions of oneself."
"Negotiating with interdimensional diplomats using interpretive dance diplomacy."
"Playing hide-and-seek with the shadows of dark matter."
"Having a tea party with time-traveling dinosaurs and robot butlers."
"Juggling quantum entangled particles while riding a quantum unicycle."
"Hosting a holographic game night with ghostly entities."
"Impersonating a comet to get a front-row seat at a cosmic concert."
"Negotiating peace treaties between time-traveling pirates and space ninjas."
"Having a conversation with extraterrestrial rock formations using telepathic vibrations."
"Playing hide-and-seek with Schroedinger's cat in a teleportation maze."
"Participating in a zero-gravity synchronized swimming competition."
"Attempting to communicate with intergalactic space chickens using semaphore signals."
"Building sandcastles on exoplanets with cosmic ocean waves."
"Convincing black holes to participate in a gravity-defying dance-off."
"Befriending time-traveling flamingos in a temporal oasis."
"Wrestling quantum particles for a game of subatomic tag."
"Polishing the interstellar mirror for a reflection of parallel selves."
"Organizing a parallel universe hide-and-seek tournament."
"Playing chess with a sentient nebula and losing gracefully."
"Hosting a telepathic tea party for sentient clouds."
"Creating crop circles in zero-gravity fields with tractor beams."
"Negotiating with interdimensional diplomats using interpretive dance diplomacy."
"Conducting an orchestra of alien bug symphonies."
"Summoning UFOs with interpretative dance rituals."
"Building sandcastles on exoplanets with cosmic ocean waves."
"Practicing levitation with levitating space jellyfish."
"Attending a zero-gravity synchronized swimming competition."
"Participating in a relay race across the rings of Jupiter."
"Defying gravity by hosting upside-down picnics on magnetic asteroids."
"Negotiating peace treaties between time-traveling dinosaurs and future robots."
"Juggling quantum entangled particles while riding a quantum unicycle."
"Having a tea party with time-traveling dinosaurs and robot butlers."
"Negotiating with interdimensional diplomats using interpretive dance diplomacy."
"Playing hide-and-seek with the shadows of dark matter."
"Exchanging love letters with parallel universe versions of oneself."
"Impersonating a comet to get a front-row seat at a cosmic concert."
"Negotiating peace treaties between time-traveling pirates and space ninjas."
"Having a conversation with extraterrestrial rock formations using telepathic vibrations."
"Playing hide-and-seek with Schroedinger's cat in a teleportation maze."
"Participating in a zero-gravity synchronized swimming competition."
"Attempting to communicate with intergalactic space chickens using semaphore signals."
"Building sandcastles on exoplanets with cosmic ocean waves."
"Convincing black holes to participate in a gravity-defying dance-off."
"Befriending time-traveling flamingos in a temporal oasis."
"Wrestling quantum particles for a game of subatomic tag."
"Polishing the interstellar mirror for a reflection of parallel selves."
"Organizing a parallel universe hide-and-seek tournament."
"Playing chess with a sentient nebula and losing gracefully."
"Hosting a telepathic tea party for sentient clouds."
"Creating crop circles in zero-gravity fields with tractor beams."
"Negotiating with interdimensional diplomats using interpretive dance diplomacy."
"Conducting an orchestra of alien bug symphonies."
"Summoning UFOs with interpretative dance rituals."
"Building sandcastles on exoplanets with cosmic ocean waves."
"Practicing levitation with levitating space jellyfish."
`.split(`
`).map((x) => x.trim().replace(/"/g, ``)).filter((x) => x);

// library/ricklove/my-cushy-deck/src/_loadingMessage.ts
var rand = createRandomGenerator(`${Date.now()}`);
var showLoadingMessage = (runtime, title, data) => {
  const message = `### Loading... 
    
${title}

${!data ? `` : Object.entries(data).map(
    ([k, v]) => typeof v === `string` && v.includes(`
`) ? `- ${k}: 

    ${v.split(`
`).join(`
    `)}` : `- ${k}: ${v}`
  ).join(`
`)}

### Detailed Master Plan

${[...new Array(20)].map((_) => `- ${rand.randomItem(loadingMessages)}`).join(`
`)}

### Oops...

- If you are reading this somehting probably broke
- Manual intervention is likely required
- Not sure why you are still reading
- You should probably do something
    
    `;
  console.log(`showLoadingMessage`, message);
  let messageItem = runtime.output_text(message);
  const timeoutId = setTimeout(() => {
    messageItem.delete();
    messageItem = runtime.output_Markdown(message);
  }, 1e3);
  return {
    delete: () => {
      clearTimeout(timeoutId);
      messageItem.delete();
    }
  };
};

// library/ricklove/my-cushy-deck/src/_cache.ts
var history = {
  writtenFormSerialWithPath: /* @__PURE__ */ new Set()
};
var cacheImageBuilder = (state, folderPrefix, params, dependencyKeyRef) => {
  const { runtime, graph } = state;
  const paramsHash = `` + createRandomGenerator(`${JSON.stringify(params)}:${dependencyKeyRef.dependencyKey}`).randomInt();
  dependencyKeyRef.dependencyKey = paramsHash;
  const paramsFolderPattern = `${state.workingDirectory}/${folderPrefix}-${paramsHash}`;
  const location = `input`;
  const paramsFilePattern = `../${location}/${paramsFolderPattern}/#####.png`;
  const saveFormSerial = () => {
    const { comfyUiInputRelativePath } = state;
    if (!comfyUiInputRelativePath) {
      return;
    }
    const formSerialHash = `` + createRandomGenerator(`${JSON.stringify(runtime.formSerial)}`).randomInt();
    const formSerialSavePath = runtime.path.join(comfyUiInputRelativePath, paramsFolderPattern, `${formSerialHash}.json`);
    const formSerialWithPath = `${formSerialHash}:${formSerialSavePath}`;
    if (history.writtenFormSerialWithPath.has(`${formSerialWithPath}`)) {
      return;
    }
    history.writtenFormSerialWithPath.add(formSerialWithPath);
    console.log(`formSerialSavePath`, { formSerialSavePath });
    runtime.fs.mkdirSync(runtime.path.dirname(formSerialSavePath), { recursive: true });
    runtime.fs.writeFileSync(formSerialSavePath, JSON.stringify(runtime.formSerial));
  };
  saveFormSerial();
  const exists = async (frameIndex) => {
    return await state.runtime.doesComfyImageExist({
      type: location,
      subfolder: paramsFolderPattern,
      filename: `${`${frameIndex}`.padStart(5, `0`)}.png`
    });
  };
  const loadCached = () => {
    const loadImageNode = graph.RL$_LoadImageSequence({
      path: paramsFilePattern,
      current_frame: 0
    });
    const imageReloaded = loadImageNode.outputs.image;
    return {
      getOutput: () => imageReloaded,
      modify: (frameIndex) => {
        loadImageNode.inputs.current_frame = frameIndex;
      }
    };
  };
  const createCache = (getValue) => {
    const image = getValue();
    if (!image) {
      return {
        // undefined
        getOutput: () => image,
        modify: (frameIndex) => {
        }
      };
    }
    const saveImageNode = graph.RL$_SaveImageSequence({
      images: image,
      current_frame: 0,
      path: paramsFilePattern
    });
    graph.PreviewImage({
      images: image
    });
    return {
      getOutput: () => image,
      modify: (frameIndex) => {
        saveImageNode.inputs.current_frame = frameIndex;
      }
    };
  };
  return {
    exists,
    loadCached,
    createCache
  };
};
var cacheMaskBuilder = (state, folderPrefix, params, dependencyKeyRef) => {
  const { graph } = state;
  const imageBuilder = cacheImageBuilder(state, folderPrefix, params, dependencyKeyRef);
  return {
    exists: imageBuilder.exists,
    loadCached: () => {
      const loadCached_image = imageBuilder.loadCached();
      return {
        getOutput: () => {
          const reloadedMaskImage = loadCached_image.getOutput();
          const maskReloaded = graph.Image_To_Mask({
            image: reloadedMaskImage,
            method: `intensity`
          }).outputs.MASK;
          return maskReloaded;
        },
        modify: (frameIndex) => loadCached_image.modify(frameIndex)
      };
    },
    createCache: (getValue) => {
      const mask = getValue();
      if (!mask) {
        return void 0;
      }
      const createCache_image = imageBuilder.createCache(() => {
        const maskImage = graph.MaskToImage({ mask });
        return maskImage;
      });
      return {
        getOutput: () => {
          return mask;
        },
        modify: (frameIndex) => createCache_image.modify(frameIndex)
      };
    }
  };
};

// library/ricklove/my-cushy-deck/src/_steps.ts
var createStepsSystem = (appState) => {
  const _state = appState;
  _state.workingDirectory = `${_state.imageDirectory}/working`;
  const stepsRegistry = [];
  const defineStep = ({
    name,
    inputSteps,
    create,
    modify,
    preview = false,
    cacheParams
  }) => {
    const stepDefinition = {
      name,
      inputSteps,
      create,
      modify,
      preview,
      cacheParams,
      $Outputs: void 0
    };
    stepsRegistry.push(stepDefinition);
    return stepDefinition;
  };
  const buildStep = (stepDef) => {
    console.log(`buildStep:`, stepDef);
    const { inputSteps, create, modify, preview } = stepDef;
    const inputs = Object.fromEntries(
      Object.values(inputSteps).flatMap((x) => Object.entries(x?._build?.outputs ?? {}))
    );
    console.log(`buildStep: inputs`, { inputs });
    const { nodes, outputs } = create(_state, { inputs });
    console.log(`buildStep: outputs`, { outputs });
    const stepBuildDefinition = {
      setFrameIndex: (frameIndex) => modify({ nodes, frameIndex }),
      outputs,
      // canBeCached,
      _nodes: nodes
    };
    stepDef._build = stepBuildDefinition;
    console.log(`buildStep: stepBuildDefinition`, {
      stepBuildDefinition,
      // canBeCached, cachableOutputs,
      stepDef
    });
    return stepBuildDefinition;
  };
  const runSteps = async (frameIndexes) => {
    const dependencyKeyRef = { dependencyKey: `` };
    const changeFrame = (frameIndex) => {
      stepsRegistry.forEach((s) => s._build?.setFrameIndex(frameIndex));
    };
    try {
      for (const stepDef of stepsRegistry) {
        console.log(`runSteps: buildStep START`, {
          stepName: stepDef.name,
          stepDef,
          ...getEnabledNodeNames(_state.runtime)
        });
        const iStepStart = getNextActiveNodeIndex(_state.runtime);
        const stepBuild = buildStep(stepDef);
        console.log(`runSteps: check for cachable outputs`, { stepName: stepDef.name, stepDef });
        const cachedOutputs = [];
        for (const kOutput in stepBuild.outputs) {
          const vOutput = stepBuild.outputs[kOutput];
          const getCacheBuilderResult = () => {
            if (typeof vOutput !== `object`) {
              return;
            }
            const vOutputTyped = vOutput;
            const vOutputSchemaType = vOutputTyped.node?.$schema.outputs[vOutputTyped.slotIx ?? 0].typeName;
            const vOutputType = vOutputSchemaType?.toLowerCase();
            if (vOutputType === `image`) {
              return cacheImageBuilder(_state, kOutput, stepDef.cacheParams, dependencyKeyRef);
            }
            if (vOutputType === `mask`) {
              return cacheMaskBuilder(_state, kOutput, stepDef.cacheParams, dependencyKeyRef);
            }
            return void 0;
          };
          const cacheBuilderResult = getCacheBuilderResult();
          if (!cacheBuilderResult) {
            console.log(`runSteps: step SKIPPED - no cacheBuilderResult`, {
              stepName: stepDef.name,
              kOutput,
              stepDef,
              vOutput
            });
            continue;
          }
          console.log(`runSteps: check for uncached frames`, {
            stepName: stepDef.name,
            kOutput,
            stepDef
          });
          const missingFrameIndexes = [];
          for (const frameIndex of frameIndexes) {
            if (!await cacheBuilderResult.exists(frameIndex)) {
              missingFrameIndexes.push(frameIndex);
            }
          }
          if (missingFrameIndexes.length) {
            console.log(`runSteps: createCache START: create missing cache frames`, {
              stepName: stepDef.name,
              kOutput,
              stepDef,
              missingFrameIndexes,
              ...getEnabledNodeNames(_state.runtime)
            });
            const iCache = getNextActiveNodeIndex(_state.runtime);
            const cacheResult = cacheBuilderResult.createCache(() => vOutput);
            if (!cacheResult) {
              disableNodesAfterInclusive(_state.runtime, iCache);
              console.log(`runSteps: cacheResult is MISSING - cannot cache`, {
                stepName: stepDef.name,
                kOutput,
                stepDef,
                missingFrameIndexes,
                ...getEnabledNodeNames(_state.runtime)
              });
              continue;
            }
            const { getOutput: getCachedOutput2, modify: modifyCacheLoader2 } = cacheResult;
            const loadingMessage = showLoadingMessage(_state.runtime, `Generating cache`, {
              stepName: stepDef.name,
              kOutput,
              frameIndexes
            });
            await new Promise((r) => setTimeout(r, 10));
            for (const frameIndex of frameIndexes) {
              changeFrame(frameIndex);
              modifyCacheLoader2(frameIndex);
              await _state.runtime.PROMPT();
              await new Promise((r) => setTimeout(r, 10));
            }
            disableNodesAfterInclusive(_state.runtime, iCache);
            console.log(`runSteps: createCache END`, {
              stepName: stepDef.name,
              kOutput,
              stepDef,
              missingFrameIndexes,
              ...getEnabledNodeNames(_state.runtime)
            });
            await new Promise((r) => setTimeout(r, 10));
            loadingMessage.delete();
          }
          console.log(
            `runSteps: loadCached - replace output with cached output ${missingFrameIndexes.length ? `` : `NO Missing Frames to cache`}`,
            {
              stepName: stepDef.name,
              kOutput,
              stepDef,
              missingFrameIndexes
            }
          );
          const { getOutput: getCachedOutput, modify: modifyCacheLoader } = cacheBuilderResult.loadCached();
          stepBuild.outputs[kOutput] = getCachedOutput();
          stepBuild.setFrameIndex = modifyCacheLoader;
          cachedOutputs.push({
            loadCacheAsOutput: () => {
              const loader = cacheBuilderResult.loadCached();
              stepBuild.outputs[kOutput] = loader.getOutput();
              stepBuild.setFrameIndex = loader.modify;
            }
          });
        }
        if (cachedOutputs.length !== Object.keys(stepBuild.outputs).length) {
          console.log(`runSteps: NOT FULLY CACHED`, {
            stepName: stepDef.name,
            stepDef,
            ...getEnabledNodeNames(_state.runtime)
          });
          if (stepDef.preview) {
            _state.graph.PreviewImage({ images: _state.runtime.AUTO });
            throw new PreviewStopError(void 0);
          }
          continue;
        }
        console.log(`runSteps: remove non-cache nodes and add load cache`, {
          stepName: stepDef.name,
          stepDef,
          ...getEnabledNodeNames(_state.runtime)
        });
        disableNodesAfterInclusive(_state.runtime, iStepStart);
        cachedOutputs.forEach((x) => x.loadCacheAsOutput());
        console.log(`runSteps: step CACHED`, {
          stepName: stepDef.name,
          stepDef,
          ...getEnabledNodeNames(_state.runtime)
        });
        if (stepDef.preview) {
          _state.graph.PreviewImage({ images: _state.runtime.AUTO });
          throw new PreviewStopError(void 0);
        }
      }
    } catch (err) {
      if (!(err instanceof PreviewStopError)) {
        throw err;
      }
      console.log(`runSteps: Stop Preview - Running up to this point in the graph for all frames`, {
        ...getEnabledNodeNames(_state.runtime)
      });
      for (const frameIndex of frameIndexes) {
        changeFrame(frameIndex);
        if (err.setFrameIndex) {
          err.setFrameIndex(frameIndex);
        }
        await _state.runtime.PROMPT();
      }
      throw new PreviewStopError(() => {
      });
    }
    return dependencyKeyRef;
  };
  return {
    state: _state,
    defineStep,
    runSteps
  };
};

// library/ricklove/my-cushy-deck/src/_imageOperations.ts
var createImageOperation = (op) => op;
var createImageOperationValue = (op) => op;
var operation_zoeDepthPreprocessor = createImageOperation({
  ui: (form) => ({
    zoeDepth: form.groupOpt({
      items: () => ({
        cutoffMid: form.float({ default: 0.5, min: 0, max: 1, step: 1e-3 }),
        cutoffRadius: form.float({ default: 0.1, min: 0, max: 1, step: 1e-3 })
        // normMin: form.float({ default: 2, min: 0, max: 100, step: 0.1 }),
        // normMax: form.float({ default: 85, min: 0, max: 100, step: 0.1 }),
        // minDepth
        // maxDepth
        // prompt: form.str({ default: `ball` }),
        // threshold: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),
        // dilation: form.int({ default: 4, min: 0 }),
        // blur: form.float({ default: 1, min: 0 }),
      })
    })
  }),
  run: ({ runtime, graph }, image, form) => {
    if (form.zoeDepth == null) {
      return image;
    }
    const zoeRaw = graph.RL$_Zoe$_Depth$_Map$_Preprocessor$_Raw$_Infer({
      image
    });
    const zoeImages = graph.RL$_Zoe$_Depth$_Map$_Preprocessor$_Raw$_Process({
      zoeRaw,
      cutoffMid: form.zoeDepth.cutoffMid,
      cutoffRadius: form.zoeDepth.cutoffRadius,
      normMin: 0,
      //form.zoeDepth.normMin,
      normMax: 100
      //form.zoeDepth.normMax,
    });
    const zoeImage = graph.ImageBatchGet({
      images: zoeImages,
      index: 2
    }).outputs.IMAGE;
    const zoeRgbImage = graph.Images_to_RGB({
      images: zoeImage
    });
    return zoeRgbImage;
  }
});
var operation_hedEdgePreprocessor = createImageOperation({
  ui: (form) => ({
    hedEdge: form.groupOpt({
      items: () => ({})
    })
  }),
  run: ({ runtime, graph }, image, form) => {
    if (form.hedEdge == null) {
      return image;
    }
    const hedImage = graph.HEDPreprocessor({
      image,
      safe: `enable`,
      version: `v1.1`
    }).outputs.IMAGE;
    return hedImage;
  }
});
var operation_pidiEdgePreprocessor = createImageOperation({
  ui: (form) => ({
    pidiEdge: form.groupOpt({
      items: () => ({})
    })
  }),
  run: ({ runtime, graph }, image, form) => {
    if (form.pidiEdge == null) {
      return image;
    }
    const pidiEdgeImage = graph.PiDiNetPreprocessor({
      image,
      safe: `enable`
    }).outputs.IMAGE;
    return pidiEdgeImage;
  }
});
var operation_scribbleEdgePreprocessor = createImageOperation({
  ui: (form) => ({
    scribbleEdge: form.groupOpt({
      items: () => ({})
    })
  }),
  run: ({ runtime, graph }, image, form) => {
    if (form.scribbleEdge == null) {
      return image;
    }
    const resultImage = graph.ScribblePreprocessor({
      image
    }).outputs.IMAGE;
    return resultImage;
  }
});
var operation_thresholdPreprocessor = createImageOperation({
  ui: (form) => ({
    threshold: form.groupOpt({
      items: () => ({
        threshold: form.int({ default: 128, min: 0, max: 255 })
      })
    })
  }),
  run: ({ runtime, graph }, image, form) => {
    if (form.threshold == null) {
      return image;
    }
    const resultImage = graph.BinaryPreprocessor({
      image,
      threshold: form.threshold.threshold
    }).outputs.IMAGE;
    return resultImage;
  }
});
var operation_baeNormalPreprocessor = createImageOperation({
  ui: (form) => ({
    baeNorma: form.groupOpt({
      items: () => ({})
    })
  }),
  run: ({ runtime, graph }, image, form) => {
    if (form.baeNorma == null) {
      return image;
    }
    const baeNormalImage = graph.BAE$7NormalMapPreprocessor({
      image
    }).outputs.IMAGE;
    return baeNormalImage;
  }
});
var operation_openPosePreprocessor = createImageOperation({
  ui: (form) => ({
    openPose: form.groupOpt({
      items: () => ({
        body: form.bool({}),
        face: form.bool({}),
        hand: form.bool({})
      })
    })
  }),
  run: ({ runtime, graph }, image, form) => {
    if (form.openPose == null) {
      return image;
    }
    const openPoseImage = graph.OpenposePreprocessor({
      image,
      detect_body: form.openPose.body ? "enable" : `disable`,
      detect_face: form.openPose.face ? "enable" : `disable`,
      detect_hand: form.openPose.hand ? "enable" : `disable`
    }).outputs.IMAGE;
    return openPoseImage;
  }
});
var operation_enhanceLighting = createImageOperation({
  ui: (form) => ({
    enhanceLighting: form.groupOpt({
      items: () => ({
        // previewAll: form.inlineRun({}),
        preview: form.groupOpt({
          items: () => ({
            img_all: form.inlineRun({}),
            img_intensity: form.inlineRun({}),
            img_gamma: form.inlineRun({}),
            img_log: form.inlineRun({}),
            img_rescale: form.inlineRun({}),
            out_shadows: form.inlineRun({}),
            out_highlights: form.inlineRun({}),
            out_mid: form.inlineRun({}),
            img_eq: form.inlineRun({}),
            img_adaptive: form.inlineRun({}),
            img_eq_local: form.inlineRun({})
          })
        }),
        selected: form.selectOne({
          choices: [
            `img_intensity`,
            `img_gamma`,
            `img_log`,
            `img_rescale`,
            `out_shadows`,
            `out_highlights`,
            `out_mid`,
            `img_eq`,
            `img_adaptive`,
            `img_eq_local`
          ].map((x) => ({ id: x }))
        }),
        previewSelected: form.inlineRun({})
      })
    })
  }),
  run: ({ runtime, graph }, image, form) => {
    if (form.enhanceLighting == null) {
      return image;
    }
    const imageShadowNode = graph.RL$_Image$_Shadow({
      image
    });
    const activiatePreviewKey = Object.entries(form.enhanceLighting.preview ?? {}).find(
      ([k, v]) => v
    )?.[0];
    if (activiatePreviewKey) {
      graph.PreviewImage({
        images: imageShadowNode.outputs[activiatePreviewKey]
      });
      throw new PreviewStopError(() => {
      });
    }
    const selectedImage = imageShadowNode.outputs[form.enhanceLighting.selected.id] ?? image;
    if (form.enhanceLighting.previewSelected) {
      graph.PreviewImage({
        images: selectedImage
      });
      throw new PreviewStopError(() => {
      });
    }
    return selectedImage;
  }
});
var operation_blendImages = createImageOperation({
  ui: (form) => ({
    blendImages: form.groupOpt({
      items: () => ({
        // operation: form.selectOne({
        //     choices: [{ id: `union` }, { id: `intersection` }],
        // }),
        a: form.group({
          layout: `V`,
          items: () => ({
            name: form.string({ default: `a` })
            // inverse: form.empt,
            // inverse: form.bool({ default: false }),
          })
        }),
        b: form.group({
          layout: `V`,
          items: () => ({
            name: form.string({ default: `b` }),
            inverse: form.bool({ default: false }),
            blendRatio: form.float({ default: 0.5, min: 0, max: 1, step: 0.01 }),
            blendMode: form.enum({ enumName: `Enum_ImageBlend_blend_mode`, default: `normal` })
          })
        })
        // c: form.groupOpt({
        //     layout: `V`,
        //     items: () => ({
        //         name: form.string({ default: `c` }),
        //         inverse: form.bool({ default: false }),
        //     }),
        // }),
        // d: form.groupOpt({
        //     layout: `V`,
        //     items: () => ({
        //         name: form.string({ default: `d` }),
        //         inverse: form.bool({ default: false }),
        //     }),
        // }),
        // e: form.groupOpt({
        //     layout: `V`,
        //     items: () => ({
        //         name: form.string({ default: `d` }),
        //         inverse: form.bool({ default: false }),
        //     }),
        // }),
      })
    })
  }),
  run: (state, image, form) => {
    if (form.blendImages == null) {
      return image;
    }
    image = loadFromScope(state, form.blendImages.a.name) ?? image;
    const otherImages = [
      form.blendImages.b
      // form.blendImages.c, form.blendImages.d, form.blendImages.e
    ].filter((x) => x).map((x) => x);
    const { graph } = state;
    for (const item of otherImages) {
      let itemImage = loadFromScope(state, item.name);
      if (!itemImage) {
        continue;
      }
      itemImage = !item.inverse ? itemImage : graph.ImageInvert({ image: itemImage });
      if (!image) {
        image = itemImage;
        continue;
      }
      if (item === form.blendImages.a) {
        continue;
      }
      image = graph.ImageBlend({
        image1: image,
        image2: itemImage,
        blend_mode: item.blendMode,
        blend_factor: item.blendRatio
      });
    }
    return image;
  }
});
var operation_storeImage = createImageOperation({
  ui: (form) => ({
    storeImage: form.groupOpt({
      items: () => ({
        name: form.string({ default: `a` })
      })
    })
  }),
  run: (state, image, form) => {
    if (form.storeImage == null) {
      return image;
    }
    storeInScope(state, form.storeImage.name, `image`, image);
    return image;
  }
});
var operation_loadImage = createImageOperation({
  ui: (form) => ({
    loadImage: form.groupOpt({
      items: () => ({
        name: form.string({ default: `a` })
      })
    })
  }),
  run: (state, image, form) => {
    if (form.loadImage == null) {
      return image;
    }
    return loadFromScope(state, form.loadImage.name) ?? image;
  }
});
var operations_all2 = createImageOperation({
  ui: (form) => ({
    imageOperations: form.list({
      element: () => form.group({
        layout: "V",
        items: () => ({
          ...operation_loadImage.ui(form),
          ...operation_enhanceLighting.ui(form),
          ...operation_zoeDepthPreprocessor.ui(form),
          ...operation_hedEdgePreprocessor.ui(form),
          ...operation_pidiEdgePreprocessor.ui(form),
          ...operation_scribbleEdgePreprocessor.ui(form),
          ...operation_baeNormalPreprocessor.ui(form),
          ...operation_openPosePreprocessor.ui(form),
          ...operation_thresholdPreprocessor.ui(form),
          ...operation_blendImages.ui(form),
          ...operation_storeImage.ui(form),
          preview: form.inlineRun({})
        })
      })
    })
  }),
  run: (state, image, form) => {
    const { runtime, graph } = state;
    for (const op of form.imageOperations) {
      image = operation_loadImage.run(state, image, op);
      image = operation_enhanceLighting.run(state, image, op);
      image = operation_zoeDepthPreprocessor.run(state, image, op);
      image = operation_hedEdgePreprocessor.run(state, image, op);
      image = operation_pidiEdgePreprocessor.run(state, image, op);
      image = operation_scribbleEdgePreprocessor.run(state, image, op);
      image = operation_baeNormalPreprocessor.run(state, image, op);
      image = operation_openPosePreprocessor.run(state, image, op);
      image = operation_thresholdPreprocessor.run(state, image, op);
      image = operation_blendImages.run(state, image, op);
      image = operation_storeImage.run(state, image, op);
      if (op.preview) {
        graph.PreviewImage({ images: image });
        throw new PreviewStopError(void 0);
      }
    }
    return image;
  }
});
var operation_image = createImageOperationValue({
  ui: (form) => operations_all2.ui(form).imageOperations,
  run: (state, image, form) => operations_all2.run(state, image, { imageOperations: form })
});

// library/ricklove/my-cushy-deck/src/_operations/_frame.ts
var CacheStopError = class extends Error {
  constructor() {
    super();
  }
};
var createFrameOperation = (op) => op;
var createFrameOperationValue = (op) => op;
var createFrameOperationsGroupList = (operations) => createFrameOperationValue({
  ui: (form) => form.list({
    element: () => form.group({
      layout: "V",
      items: () => ({
        ...Object.fromEntries(
          Object.entries(operations).map(([k, v]) => {
            return [
              k,
              form.groupOpt({
                items: () => v.ui(form)
              })
            ];
          })
        ),
        preview: form.inlineRun({})
      })
    })
  }),
  run: (state, form, frame) => {
    const { runtime, graph } = state;
    for (const listItem of form) {
      const listItemGroupOptFields = listItem;
      for (const [opName, op] of Object.entries(operations)) {
        const opGroupOptValue = listItemGroupOptFields[opName];
        if (opGroupOptValue == null) {
          continue;
        }
        frame = {
          ...frame,
          ...op.run(state, opGroupOptValue, frame)
        };
      }
      if (listItem.preview) {
        graph.PreviewImage({ images: frame.image });
        throw new PreviewStopError(void 0);
      }
    }
    return frame;
  }
});
var createFrameOperationsChoiceList = (operations) => createFrameOperationValue({
  ui: (form) => form.list({
    element: () => form.choice({
      items: () => ({
        ...Object.fromEntries(
          Object.entries(operations).map(([k, v]) => {
            return [
              k,
              form.group({
                items: () => ({
                  ...v.ui(form),
                  __cache: form.bool({}),
                  __preview: form.inlineRun({})
                })
              })
            ];
          })
        )
      })
    })
  }),
  run: (state, form, frame) => {
    const { runtime, graph } = state;
    const formItemCacheState = {
      dependencyKey: `42`,
      cacheNumber: frame.cacheCount_current
    };
    const opStates = form.map((x) => {
      const cleanedFormItem = {
        ...Object.fromEntries(
          Object.entries(x).map(([k, v]) => [
            k,
            !v ? void 0 : {
              ...v,
              __cache: void 0,
              __preview: void 0
            }
          ])
        )
      };
      const dependencyKey = formItemCacheState.dependencyKey = `${createRandomGenerator(
        `${formItemCacheState.dependencyKey}:${JSON.stringify(cleanedFormItem)}`
      ).randomInt()}`;
      const shouldCache = Object.entries(x).some(([k, v]) => v?.__cache);
      const cacheNumber = !shouldCache ? formItemCacheState.cacheNumber : formItemCacheState.cacheNumber = formItemCacheState.cacheNumber + 1;
      const isStopped = cacheNumber > frame.cacheCount_stop;
      const isCached = state.cacheState.exists(dependencyKey, frame.cacheFrameId);
      return {
        item: x,
        dependencyKey,
        cacheNumber,
        isStopped,
        shouldCache,
        isCached
      };
    });
    const iLastCacheToUse = opStates.findLastIndex((x) => !x.isStopped && x.isCached);
    const opStatesStartingWithCached = opStates.slice(iLastCacheToUse);
    for (const {
      item: listItem,
      dependencyKey,
      isCached,
      cacheNumber,
      shouldCache,
      isStopped
    } of opStatesStartingWithCached) {
      if (isCached) {
        const cacheResult = state.cacheState.get(dependencyKey, frame.cacheFrameId);
        if (!cacheResult) {
          throw new Error(`Cache is missing, but reported as existing ${JSON.stringify({ cacheNumber, listItem })}`);
        }
        frame = { ...frame, ...cacheResult.frame };
        state.scopeStack = cacheResult.scopeStack;
        continue;
      }
      const listItemGroupOptFields = listItem;
      for (const [opName, op] of Object.entries(operations)) {
        const opGroupOptValue = listItemGroupOptFields[opName];
        if (opGroupOptValue == null) {
          continue;
        }
        frame = {
          ...frame,
          ...op.run(state, opGroupOptValue, frame)
        };
        if (opGroupOptValue.__preview) {
          graph.PreviewImage({ images: frame.image });
          graph.PreviewImage({ images: graph.MaskToImage({ mask: frame.mask }) });
          graph.PreviewImage({
            images: graph.ImageBlend({
              image1: frame.image,
              image2: graph.MaskToImage({ mask: frame.mask }),
              blend_mode: `normal`,
              blend_factor: 0.5
            })
          });
          throw new PreviewStopError(void 0);
        }
      }
      if (shouldCache && !isCached) {
        state.cacheState.set(dependencyKey, frame.cacheFrameId, {
          frame,
          scopeStack: state.scopeStack
        });
        frame = {
          ...frame,
          cacheCount_current: cacheNumber
        };
        if (frame.cacheCount_current >= frame.cacheCount_stop) {
          throw new CacheStopError();
        }
      }
    }
    return frame;
  }
});

// library/ricklove/my-cushy-deck/src/_operations/image.ts
var zoeDepth = createFrameOperation({
  ui: (form) => ({
    cutoffMid: form.float({ default: 0.5, min: 0, max: 1, step: 1e-3 }),
    cutoffRadius: form.float({ default: 0.1, min: 0, max: 1, step: 1e-3 }),
    invertCutoffMax: form.bool({ default: false }),
    invertCutoffMin: form.bool({ default: false })
    // normMin: form.float({ default: 2, min: 0, max: 100, step: 0.1 }),
    // normMax: form.float({ default: 85, min: 0, max: 100, step: 0.1 }),
  }),
  run: ({ runtime, graph }, form, { image }) => {
    const zoeRaw = graph.RL$_Zoe$_Depth$_Map$_Preprocessor$_Raw$_Infer({
      image
    });
    const zoeImages = graph.RL$_Zoe$_Depth$_Map$_Preprocessor$_Raw$_Process({
      zoeRaw,
      // This makes more sense reversed
      cutoffMid: 1 - form.cutoffMid,
      cutoffRadius: form.cutoffRadius,
      normMin: 0,
      //form.zoeDepth.normMin,
      normMax: 100
      //form.zoeDepth.normMax,
    });
    const zoeImage = graph.ImageBatchGet({
      images: zoeImages,
      index: 2
    }).outputs.IMAGE;
    const zoeRgbImage = graph.Images_to_RGB({
      images: zoeImage
    });
    let resultImage = zoeRgbImage.outputs.IMAGE;
    if (!form.invertCutoffMax && !form.invertCutoffMin) {
      return { image: resultImage };
    }
    const invertedImage = graph.InvertImage({ image: resultImage });
    if (form.invertCutoffMax) {
      const removeMask = graph.ImageColorToMask({
        image: resultImage,
        color: 16777215
      });
      resultImage = graph.Image_Blend_by_Mask({
        image_a: resultImage,
        image_b: invertedImage,
        mask: graph.MaskToImage({ mask: removeMask }),
        blend_percentage: 1
      }).outputs.IMAGE;
    }
    if (form.invertCutoffMin) {
      const removeMask = graph.ImageColorToMask({
        image: resultImage,
        color: 0
      });
      resultImage = graph.Image_Blend_by_Mask({
        image_a: resultImage,
        image_b: invertedImage,
        mask: graph.MaskToImage({ mask: removeMask }),
        blend_percentage: 1
      }).outputs.IMAGE;
    }
    return { image: resultImage };
  }
});
var hedEdge = createFrameOperation({
  ui: (form) => ({}),
  run: ({ runtime, graph }, form, { image }) => {
    const resultImage = graph.HEDPreprocessor({
      image,
      safe: `enable`,
      version: `v1.1`
    }).outputs.IMAGE;
    return { image: resultImage };
  }
});
var pidiEdge = createFrameOperation({
  ui: (form) => ({}),
  run: ({ runtime, graph }, form, { image }) => {
    const resultImage = graph.PiDiNetPreprocessor({
      image,
      safe: `enable`
    }).outputs.IMAGE;
    return { image: resultImage };
  }
});
var scribbleEdge = createFrameOperation({
  ui: (form) => ({}),
  run: ({ runtime, graph }, form, { image }) => {
    const resultImage = graph.ScribblePreprocessor({
      image
    }).outputs.IMAGE;
    return { image: resultImage };
  }
});
var threshold = createFrameOperation({
  ui: (form) => ({
    threshold: form.int({ default: 128, min: 0, max: 255 })
  }),
  run: ({ runtime, graph }, form, { image }) => {
    const resultImage = graph.BinaryPreprocessor({
      image,
      threshold: form.threshold
    }).outputs.IMAGE;
    return { image: resultImage };
  }
});
var baeNormal = createFrameOperation({
  ui: (form) => ({}),
  run: ({ runtime, graph }, form, { image }) => {
    const resultImage = graph.BAE$7NormalMapPreprocessor({
      image
    }).outputs.IMAGE;
    return { image: resultImage };
  }
});
var openPose = createFrameOperation({
  ui: (form) => ({
    body: form.bool({}),
    face: form.bool({}),
    hand: form.bool({})
  }),
  run: ({ runtime, graph }, form, { image }) => {
    const resultImage = graph.OpenposePreprocessor({
      image,
      detect_body: form.body ? "enable" : `disable`,
      detect_face: form.face ? "enable" : `disable`,
      detect_hand: form.hand ? "enable" : `disable`
    }).outputs.IMAGE;
    return { image: resultImage };
  }
});
var enhanceLighting = createFrameOperation({
  ui: (form) => ({
    // previewAll: form.inlineRun({}),
    preview: form.groupOpt({
      items: () => ({
        img_all: form.inlineRun({}),
        img_intensity: form.inlineRun({}),
        img_gamma: form.inlineRun({}),
        img_log: form.inlineRun({}),
        img_rescale: form.inlineRun({}),
        out_shadows: form.inlineRun({}),
        out_highlights: form.inlineRun({}),
        out_mid: form.inlineRun({}),
        img_eq: form.inlineRun({}),
        img_adaptive: form.inlineRun({}),
        img_eq_local: form.inlineRun({})
      })
    }),
    selected: form.selectOne({
      choices: [
        `img_intensity`,
        `img_gamma`,
        `img_log`,
        `img_rescale`,
        `out_shadows`,
        `out_highlights`,
        `out_mid`,
        `img_eq`,
        `img_adaptive`,
        `img_eq_local`
      ].map((x) => ({ id: x }))
    }),
    previewSelected: form.inlineRun({})
  }),
  run: ({ runtime, graph }, form, { image }) => {
    const imageShadowNode = graph.RL$_Image$_Shadow({
      image
    });
    const activiatePreviewKey = Object.entries(form.preview ?? {}).find(
      ([k, v]) => v
    )?.[0];
    if (activiatePreviewKey) {
      graph.PreviewImage({
        images: imageShadowNode.outputs[activiatePreviewKey]
      });
      throw new PreviewStopError(() => {
      });
    }
    const selectedImage = imageShadowNode.outputs[form.selected.id] ?? image;
    if (form.previewSelected) {
      graph.PreviewImage({
        images: selectedImage
      });
      throw new PreviewStopError(() => {
      });
    }
    return { image: selectedImage };
  }
});
var colorSelect = createFrameOperation({
  ui: (form) => ({
    color: form.color({ default: `#000000` }),
    variance: form.int({ default: 10, min: 0, max: 255 })
  }),
  run: ({ runtime, graph }, form, { image, mask }) => {
    const rgb = Number.parseInt(form.color.slice(1), 16);
    const r = (rgb / 256 / 256 | 0) % 256;
    const g = (rgb / 256 | 0) % 256;
    const b = (rgb | 0) % 256;
    const colorImage = graph.Image_Select_Color({
      image,
      red: r,
      green: g,
      blue: b,
      variance: form.variance
    });
    return { image: colorImage };
  }
});
var blendImages = createFrameOperation({
  ui: (form) => ({
    // operation: form.selectOne({
    //     choices: [{ id: `union` }, { id: `intersection` }],
    // }),
    a: form.group({
      layout: `V`,
      items: () => ({
        name: form.string({ default: `a` })
        // inverse: form.empt,
        // inverse: form.bool({ default: false }),
      })
    }),
    b: form.group({
      layout: `V`,
      items: () => ({
        name: form.string({ default: `b` }),
        inverse: form.bool({ default: false }),
        blendRatio: form.float({ default: 0.5, min: 0, max: 1, step: 0.01 }),
        blendMode: form.enum({ enumName: `Enum_ImageBlend_blend_mode`, default: `normal` })
      })
    })
    // c: form.groupOpt({
    //     layout: `V`,
    //     items: () => ({
    //         name: form.string({ default: `c` }),
    //         inverse: form.bool({ default: false }),
    //     }),
    // }),
    // d: form.groupOpt({
    //     layout: `V`,
    //     items: () => ({
    //         name: form.string({ default: `d` }),
    //         inverse: form.bool({ default: false }),
    //     }),
    // }),
    // e: form.groupOpt({
    //     layout: `V`,
    //     items: () => ({
    //         name: form.string({ default: `d` }),
    //         inverse: form.bool({ default: false }),
    //     }),
    // }),
  }),
  run: (state, form, { image }) => {
    image = loadFromScope(state, form.a.name) ?? image;
    const otherImages = [
      form.b
      // form.blendImages.c, form.blendImages.d, form.blendImages.e
    ].filter((x) => x).map((x) => x);
    const { graph } = state;
    for (const item of otherImages) {
      let itemImage = loadFromScope(state, item.name);
      if (!itemImage) {
        continue;
      }
      itemImage = !item.inverse ? itemImage : graph.ImageInvert({ image: itemImage });
      if (!image) {
        image = itemImage;
        continue;
      }
      if (item === form.a) {
        continue;
      }
      image = graph.ImageBlend({
        image1: image,
        image2: itemImage,
        blend_mode: item.blendMode,
        blend_factor: item.blendRatio
      });
    }
    return { image };
  }
});
var imageOperations = {
  enhanceLighting,
  zoeDepth,
  hedEdge,
  pidiEdge,
  scribbleEdge,
  baeNormal,
  openPose,
  threshold,
  colorSelect,
  blendImages
};
var imageOperationsList = createFrameOperationsGroupList(imageOperations);

// library/ricklove/my-cushy-deck/src/_operations/mask.ts
var hedEdge2 = createFrameOperation({
  ui: (form) => ({}),
  run: ({ runtime, graph }, form, { image }) => {
    const resultImage = graph.HEDPreprocessor({
      image,
      safe: `enable`,
      version: `v1.1`
    }).outputs.IMAGE;
    return { image: resultImage };
  }
});
var clipSeg = createFrameOperation({
  ui: (form) => ({
    prompt: form.str({ default: `ball` }),
    threshold: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),
    dilation: form.int({ default: 4, min: 0 }),
    blur: form.float({ default: 1, min: 0 })
  }),
  run: ({ runtime, graph }, form, { image, mask }) => {
    const resultMask = graph.CLIPSeg({
      image,
      text: form.prompt,
      threshold: form.threshold,
      dilation_factor: form.dilation,
      blur: form.blur
    }).outputs.Mask;
    return { mask: resultMask };
  }
});
var imageToMask = createFrameOperation({
  ui: (form) => ({}),
  run: ({ runtime, graph }, form, { image, mask }) => {
    const imageMask = graph.Image_To_Mask({
      image,
      method: `intensity`
    });
    return { mask: imageMask };
  }
});
var maskToImage = createFrameOperation({
  ui: (form) => ({}),
  run: ({ runtime, graph }, form, { image, mask }) => {
    const maskImage = graph.MaskToImage({
      mask
    });
    return { image: maskImage };
  }
});
var erodeOrDilate = createFrameOperation({
  ui: (form) => ({
    erodeOrDilate: form.int({ min: -64, max: 64 })
  }),
  run: ({ runtime, graph }, form, { image, mask }) => {
    const resultMask = form.erodeOrDilate > 0 ? graph.Mask_Dilate_Region({ masks: mask, iterations: form.erodeOrDilate }).outputs.MASKS : form.erodeOrDilate < 0 ? graph.Mask_Erode_Region({ masks: mask, iterations: -form.erodeOrDilate }).outputs.MASKS : mask;
    return { mask: resultMask };
  }
});
var segment = createFrameOperation({
  ui: (form) => ({
    segmentIndex: form.int({ min: 0, max: 10 })
  }),
  run: ({ runtime, graph }, form, { image, mask }) => {
    const segs = graph.MaskToSEGS({
      mask
    });
    const segsFilter = graph.ImpactSEGSOrderedFilter({
      segs,
      target: `area(=w*h)`,
      take_start: form.segmentIndex
    });
    const resultMask = graph.SegsToCombinedMask({ segs: segsFilter.outputs.filtered_SEGS }).outputs.MASK;
    return { mask: resultMask };
  }
});
var sam = createFrameOperation({
  ui: (form) => ({
    // prompt: form.str({ default: `ball` }),
    threshold: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),
    detection_hint: form.enum({
      enumName: `Enum_SAMDetectorCombined_detection_hint`,
      default: `center-1`
    }),
    mask_hint_use_negative: form.enum({
      enumName: `Enum_SAMDetectorCombined_mask_hint_use_negative`,
      default: `False`
    })
    // dilation: form.int({ default: 4, min: 0 }),
    // blur: form.float({ default: 1, min: 0 }),
  }),
  run: ({ runtime, graph }, form, { image, mask }) => {
    const samModel = graph.SAMLoader({
      model_name: `sam_vit_b_01ec64.pth`,
      device_mode: `Prefer GPU`
    });
    const segs = graph.MaskToSEGS({
      mask
    });
    const resultMask = graph.SAMDetectorSegmented({
      segs,
      sam_model: samModel,
      image,
      detection_hint: form.detection_hint,
      mask_hint_use_negative: form.mask_hint_use_negative,
      threshold: form.threshold
    }).outputs.combined_mask;
    return { mask: resultMask };
  }
});
var combineMasks = createFrameOperation({
  ui: (form) => ({
    operation: form.selectOne({
      choices: [{ id: `union` }, { id: `intersection` }]
    }),
    a: form.group({
      layout: `V`,
      items: () => ({
        name: form.string({ default: `a` }),
        inverse: form.bool({ default: false })
      })
    }),
    b: form.group({
      layout: `V`,
      items: () => ({
        name: form.string({ default: `b` }),
        inverse: form.bool({ default: false })
      })
    }),
    c: form.groupOpt({
      layout: `V`,
      items: () => ({
        name: form.string({ default: `c` }),
        inverse: form.bool({ default: false })
      })
    }),
    d: form.groupOpt({
      layout: `V`,
      items: () => ({
        name: form.string({ default: `d` }),
        inverse: form.bool({ default: false })
      })
    }),
    e: form.groupOpt({
      layout: `V`,
      items: () => ({
        name: form.string({ default: `d` }),
        inverse: form.bool({ default: false })
      })
    })
  }),
  run: (state, form, { image, mask }) => {
    const { graph } = state;
    const getModifiedMask = (item) => {
      const m = loadFromScope(state, item.name);
      if (!m) {
        return void 0;
      }
      return !item.inverse ? m : graph.InvertMask({ mask: m });
    };
    let resultMask = getModifiedMask(form.a);
    const otherMasks = [form.b, form.c, form.d, form.e].filter((x) => x).map((x) => x);
    for (const mItem of otherMasks) {
      const mMask = getModifiedMask(mItem);
      if (!mMask) {
        continue;
      }
      if (!resultMask) {
        resultMask = mMask;
        continue;
      }
      resultMask = graph.ImageToMask$_AS({
        image: graph.Combine_Masks({
          image1: graph.MaskToImage({ mask: resultMask }),
          image2: graph.MaskToImage({ mask: mMask }),
          op: form.operation.id === `union` ? `union (max)` : `intersection (min)`,
          clamp_result: `yes`,
          round_result: `no`
        }).outputs.IMAGE
      }).outputs.MASK;
    }
    return { mask: resultMask };
  }
});
var maskOperations = {
  imageToMask,
  maskToImage,
  clipSeg,
  segment,
  sam,
  erodeOrDilate,
  combineMasks
};
var maskOperationsList = createFrameOperationsGroupList(maskOperations);

// library/ricklove/my-cushy-deck/src/_operations/storage.ts
var storeImageVarible = createFrameOperation({
  ui: (form) => ({
    name: form.string({ default: `a` })
  }),
  run: (state, form, { image }) => {
    storeInScope(state, form.name, `image`, image);
    return { image };
  }
});
var loadImageVariable = createFrameOperation({
  ui: (form) => ({
    name: form.string({ default: `a` })
  }),
  run: (state, form, { image }) => {
    return { image: loadFromScope(state, form.name) ?? image };
  }
});
var storeMaskVariable = createFrameOperation({
  ui: (form) => ({
    name: form.string({ default: `a` })
  }),
  run: (state, form, { image, mask }) => {
    storeInScope(state, form.name, `mask`, mask);
    return { mask };
  }
});
var loadMaskVariable = createFrameOperation({
  ui: (form) => ({
    name: form.string({ default: `a` })
  }),
  run: (state, form, { mask }) => {
    return { mask: loadFromScope(state, form.name) ?? mask };
  }
});
var storeVariables = createFrameOperation({
  ui: (form) => ({
    image: form.stringOpt({ default: `a` }),
    mask: form.stringOpt({ default: `a` })
  }),
  run: (state, form, { image, mask }) => {
    if (form.image) {
      storeInScope(state, form.image, `image`, image);
    }
    if (form.mask) {
      storeInScope(state, form.mask, `mask`, mask);
    }
    return {};
  }
});
var loadVariables = createFrameOperation({
  ui: (form) => ({
    image: form.stringOpt({ default: `a` }),
    mask: form.stringOpt({ default: `a` })
  }),
  run: (state, form, {}) => {
    return {
      image: form.image ? loadFromScope(state, form.image) : void 0,
      mask: form.mask ? loadFromScope(state, form.mask) : void 0
    };
  }
});
var storageOperations = {
  loadImageVariable,
  storeImageVarible,
  storeMaskVariable,
  loadMaskVariable,
  loadVariables,
  storeVariables
};
var storageOperationsList = createFrameOperationsGroupList(storageOperations);

// library/ricklove/my-cushy-deck/src/_operations/resizing.ts
var cropResizeByMask = createFrameOperation({
  ui: (form) => ({
    padding: form.int({ default: 0 }),
    size: form.choice({
      items: () => ({
        maxSideLength: form.intOpt({ default: 1024 }),
        target: form.group({
          items: () => ({
            width: form.intOpt({ default: 1024 }),
            height: form.floatOpt({ default: 1024 })
          })
        })
      })
    }),
    storeVariables: form.groupOpt({
      items: () => ({
        startImage: form.strOpt({ default: `beforeCropImage` }),
        startMask: form.strOpt({ default: `beforeCropMask` }),
        cropAreaMask: form.strOpt({ default: `cropArea` }),
        endImage: form.strOpt({ default: `afterCropImage` }),
        endMask: form.strOpt({ default: `afterCropMask` })
      })
    })
  }),
  run: (state, form, frame) => {
    const { runtime, graph } = state;
    const { image, mask } = frame;
    const startImage = image;
    const cropMask = mask;
    const {
      cropped_image: croppedImage,
      cropped_mask: croppedMask,
      left_source,
      right_source,
      top_source,
      bottom_source
    } = graph.RL$_Crop$_Resize({
      image: startImage,
      mask: cropMask,
      padding: form.padding,
      max_side_length: form.size.maxSideLength ?? void 0,
      width: form.size.target?.width ?? void 0,
      height: form.size.target?.height ?? void 0
    }).outputs;
    const startImageSize = graph.Get_Image_Size({
      image: startImage
    });
    const blackImage = graph.EmptyImage({
      color: 0,
      width: startImageSize.outputs.INT,
      height: startImageSize.outputs.INT_1,
      batch_size: 1
    });
    const whiteImage = graph.EmptyImage({
      color: 16777215,
      width: startImageSize.outputs.INT,
      height: startImageSize.outputs.INT_1,
      batch_size: 1
    });
    const cropAreaImage = graph.Image_Paste_Crop_by_Location({
      image: blackImage,
      crop_image: whiteImage,
      crop_blending: 0,
      left: left_source,
      right: right_source,
      top: top_source,
      bottom: bottom_source
    }).outputs.IMAGE;
    const cropAreaMask = graph.Image_To_Mask({
      image: cropAreaImage,
      method: `intensity`
    });
    if (form.storeVariables?.startImage) {
      storageOperations.storeImageVarible.run(state, { name: form.storeVariables.startImage }, { ...frame, image });
    }
    if (form.storeVariables?.endImage) {
      storageOperations.storeImageVarible.run(
        state,
        { name: form.storeVariables.endImage },
        { ...frame, image: croppedImage }
      );
    }
    if (form.storeVariables?.startMask) {
      storageOperations.storeMaskVariable.run(state, { name: form.storeVariables.startMask }, { ...frame, mask });
    }
    if (form.storeVariables?.endMask) {
      storageOperations.storeMaskVariable.run(state, { name: form.storeVariables.endMask }, { ...frame, mask: croppedMask });
    }
    if (form.storeVariables?.cropAreaMask) {
      storageOperations.storeMaskVariable.run(
        state,
        { name: form.storeVariables.cropAreaMask },
        { ...frame, mask: cropAreaMask }
      );
    }
    return { image: croppedImage, mask: croppedMask };
  }
});
var resizingOperations = {
  cropResizeByMask
};
var resizingOperationsList = createFrameOperationsGroupList(resizingOperations);

// library/ricklove/my-cushy-deck/src/_operations/allOperations.ts
var allOperationsList = createFrameOperationsChoiceList({
  ...imageOperations,
  ...maskOperations,
  ...resizingOperations,
  ...storageOperations
});

// library/ricklove/my-cushy-deck/raw-power.ts
appOptimized({
  ui: (form) => ({
    // workingDirectory: form.str({}),
    // startImage: form.image({}),
    imageSource: form.group({
      items: () => ({
        directory: form.string({ default: `video` }),
        filePattern: form.string({ default: `#####.png` }),
        // pattern: form.string({ default: `*.png` }),
        startIndex: form.int({ default: 0, min: 0 }),
        endIndex: form.intOpt({ default: 1e4, min: 0, max: 1e4 }),
        selectEveryNth: form.intOpt({ default: 1, min: 1 }),
        // batchSize: form.int({ default: 1, min: 1 }),
        iterationCount: form.int({ default: 1, min: 1 }),
        // iterationSize: form.intOpt({ default: 1, min: 1 }),
        preview: form.inlineRun({})
      })
    }),
    testAllOperationsList: allOperationsList.ui(form),
    preview_testAllOperationsList: form.inlineRun({}),
    _1: form.markdown({
      markdown: () => `# Crop Image`
    }),
    // crop1:
    cropPreImageOperations: operation_image.ui(form),
    previewCropPreImage: form.inlineRun({}),
    cropMaskOperations: operation_mask.ui(form),
    cropPadding: form.int({ default: 64 }),
    size: form.choice({
      items: () => ({
        common: form.selectOne({
          default: { id: `512` },
          choices: [{ id: `384` }, { id: `512` }, { id: `768` }, { id: `1024` }, { id: `1280` }, { id: `1920` }]
        }),
        custom: form.int({ default: 512, min: 32, max: 8096 })
      })
    }),
    sizeWidth: form.intOpt({ default: 512, min: 32, max: 8096 }),
    sizeHeight: form.intOpt({ default: 512, min: 32, max: 8096 }),
    previewCropMask: form.inlineRun({}),
    previewCrop: form.inlineRun({}),
    _2: form.markdown({
      markdown: () => `# Mask Replacement`
    }),
    //operation_mask.ui(form).maskOperations,
    replacePreImageOperations: operation_image.ui(form),
    previewReplacePreImage: form.inlineRun({}),
    replaceMaskOperations: operation_mask.ui(form),
    previewReplaceMask: form.inlineRun({}),
    // ...operation_replaceMask.ui(form),
    // mask: ui_maskPrompt(form, { defaultPrompt: `ball` }),
    _3: form.markdown({ markdown: (formRoot) => `# Generate Image` }),
    controlNet: form.list({
      element: () => form.group({
        items: () => ({
          controlNet: form.enum({
            enumName: "Enum_ControlNetLoader_control_net_name",
            default: "sdxl-depth-mid.safetensors"
          }),
          // preprocessor: form.enum({
          //     enumName: 'Enum_OpenposePreprocessor_detect_body',
          //     default: 'sdxl-depth-mid.safetensors',
          // }),
          strength: form.float({ default: 1, min: 0, max: 1, step: 0.01 }),
          start: form.float({ default: 0, min: 0, max: 1, step: 0.01 }),
          end: form.float({ default: 0, min: 0, max: 1, step: 0.01 }),
          preview: form.inlineRun({})
        })
      })
    }),
    sampler: form.group({
      items: () => ({
        previewInputs: form.inlineRun({}),
        useImpaintingEncode: form.bool({ default: false }),
        previewLatent: form.inlineRun({}),
        // g: form.groupOpt({
        //     items: () => ({
        positive: form.str({}),
        negative: form.str({}),
        seed: form.seed({}),
        steps: form.int({ default: 11, min: 0, max: 100 }),
        startStep: form.intOpt({ default: 1, min: 0, max: 100 }),
        startStepFromEnd: form.intOpt({ default: 1, min: 0, max: 100 }),
        stepsToIterate: form.intOpt({ default: 2, min: 0, max: 100 }),
        endStep: form.intOpt({ default: 1e3, min: 0, max: 100 }),
        endStepFromEnd: form.intOpt({ default: 0, min: 0, max: 100 }),
        checkpoint: form.enum({
          enumName: "Enum_CheckpointLoaderSimple_ckpt_name",
          default: "nightvisionXLPhotorealisticPortrait_release0770Bakedvae.safetensors"
        }),
        sdxl: form.bool({ default: true }),
        lcm: form.bool({ default: true }),
        config: form.float({ default: 1.5 }),
        add_noise: form.bool({ default: true }),
        preview: form.inlineRun({})
      })
    }),
    film: form.groupOpt({
      items: () => ({
        singleFramePyramidSize: form.intOpt({ default: 4 }),
        sideFrameDoubleBackIterations: form.intOpt({ default: 1 }),
        preview: form.inlineRun({})
      })
    }),
    upscale: form.groupOpt({
      items: () => ({
        upscaleBy: form.float({ default: 2, min: 0, max: 10 }),
        steps: form.int({ default: 20, min: 0, max: 100 }),
        denoise: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 }),
        tileStrength: form.float({ default: 1, min: 0, max: 1 }),
        sdxl: form.bool({ default: false }),
        lcm: form.bool({ default: true }),
        // mask: form.bool({ default: true }),
        config: form.float({ default: 7, min: 0, max: 20 }),
        checkpoint: form.enum({
          enumName: "Enum_CheckpointLoaderSimple_ckpt_name",
          default: "realisticVisionV51_v51VAE-inpainting.safetensors"
        }),
        preview: form.inlineRun({})
      })
    }),
    uncrop: form.groupOpt({
      items: () => ({
        preview: form.inlineRun({})
      })
    }),
    testSeed: form.seed({}),
    test: form.custom({
      Component: OptimizerComponent,
      defaultValue: () => ({})
    })
  }),
  run: async (runtime, form) => {
    try {
      const _imageDirectory = form.imageSource.directory.replace(/\/$/g, ``);
      const {
        defineStep,
        runSteps,
        state: _state
      } = createStepsSystem({
        runtime,
        imageDirectory: form.imageSource.directory.replace(/\/$/g, ``),
        comfyUiInputRelativePath: `../comfyui/ComfyUI/input`,
        graph: runtime.nodes,
        scopeStack: [{}]
      });
      const startImageStep = defineStep({
        name: `startImageStep`,
        preview: form.imageSource.preview,
        cacheParams: [],
        inputSteps: {},
        create: ({ graph, imageDirectory, workingDirectory }, {}) => {
          const loadImageNode = graph.RL$_LoadImageSequence({
            path: `${imageDirectory}/${form.imageSource.filePattern}`,
            current_frame: 0
          });
          const startImage = loadImageNode.outputs.image;
          const saveImageNode = graph.RL$_SaveImageSequence({
            images: startImage,
            current_frame: 0,
            path: `../input/${workingDirectory}/_start-image/#####.png`
          });
          return {
            nodes: { loadImageNode, saveImageNode },
            outputs: { startImage }
          };
        },
        modify: ({ nodes, frameIndex }) => {
          nodes.loadImageNode.inputs.current_frame = frameIndex;
          nodes.saveImageNode.inputs.current_frame = frameIndex;
        }
      });
      const testAllOperationsListStep = defineStep({
        name: `testAllOperationsListStep`,
        preview: form.preview_testAllOperationsList,
        cacheParams: [form.testAllOperationsList],
        inputSteps: { startImageStep },
        create: (state, { inputs }) => {
          const { startImage } = inputs;
          const imageSize = state.graph.Get_image_size({ image: startImage });
          const fullMask = state.graph.SolidMask({
            width: imageSize.outputs.INT,
            height: imageSize.outputs.INT_1,
            value: 16777215
          });
          const result = allOperationsList.run(
            {
              ...state,
              cacheState: {
                exists: () => false,
                get: () => void 0,
                set: () => {
                }
              }
            },
            form.testAllOperationsList,
            {
              image: startImage,
              mask: fullMask,
              // ignored
              cacheCount_current: 0,
              cacheCount_stop: 1e4,
              cacheFrameId: 0
            }
          );
          return {
            nodes: {},
            outputs: { image_testAllOperationsList: result.image, mask_testAllOperationsList: result.mask }
          };
        },
        modify: ({ nodes, frameIndex }) => {
        }
      });
      const cropPreImageStep = defineStep({
        name: `cropPreImageStep`,
        preview: form.previewCropPreImage,
        cacheParams: [form.cropPreImageOperations],
        inputSteps: { startImageStep },
        create: (state, { inputs }) => {
          const { startImage } = inputs;
          const cropPreImage = operation_image.run(state, startImage, form.cropPreImageOperations);
          return {
            nodes: {},
            outputs: { cropPreImage }
          };
        },
        modify: ({ nodes, frameIndex }) => {
        }
      });
      const cropMaskStep = defineStep({
        name: `cropMaskStep`,
        preview: form.previewCropMask,
        cacheParams: [form.cropMaskOperations],
        inputSteps: { cropPreImageStep },
        create: (state, { inputs }) => {
          const { cropPreImage } = inputs;
          const cropMask = operation_mask.run(state, cropPreImage, void 0, form.cropMaskOperations);
          return {
            nodes: {},
            outputs: { cropMask }
          };
        },
        modify: ({ nodes, frameIndex }) => {
        }
      });
      const cropStep = defineStep({
        name: `cropStep`,
        preview: form.previewCrop,
        cacheParams: [form.size, form.cropPadding, form.sizeWidth, form.sizeHeight],
        inputSteps: { startImageStep, cropMaskStep },
        create: ({ graph, workingDirectory }, { inputs }) => {
          const { startImage, cropMask } = inputs;
          const { size: sizeInput, cropPadding, sizeWidth, sizeHeight } = form;
          const size = sizeInput.custom ?? Number(sizeInput.common?.id);
          const startImageSize = graph.Get_Image_Size({
            image: startImage
          });
          const {
            cropped_image: croppedImage,
            left_source,
            right_source,
            top_source,
            bottom_source
          } = !cropMask ? {
            cropped_image: startImage,
            left_source: 0,
            right_source: startImageSize.outputs.INT,
            top_source: 0,
            bottom_source: startImageSize.outputs.INT_1
          } : graph.RL$_Crop$_Resize({
            image: startImage,
            mask: cropMask,
            max_side_length: size,
            width: sizeWidth ?? void 0,
            height: sizeHeight ?? void 0,
            padding: cropPadding
          }).outputs;
          const blackImage = graph.EmptyImage({
            color: 0,
            width: startImageSize.outputs.INT,
            height: startImageSize.outputs.INT_1,
            batch_size: 1
          });
          const whiteImage = graph.EmptyImage({
            color: 16777215,
            width: startImageSize.outputs.INT,
            height: startImageSize.outputs.INT_1,
            batch_size: 1
          });
          const cropAreaImage = graph.Image_Paste_Crop_by_Location({
            image: blackImage,
            crop_image: whiteImage,
            crop_blending: 0,
            left: left_source,
            right: right_source,
            top: top_source,
            bottom: bottom_source
          }).outputs.IMAGE;
          const saveCropAreaImageNode = graph.RL$_SaveImageSequence({
            images: cropAreaImage,
            current_frame: 0,
            path: `../input/${workingDirectory}/_crop-area/#####.png`
          });
          return {
            nodes: { saveCropAreaImageNode },
            outputs: { croppedImage }
          };
        },
        modify: ({ nodes, frameIndex }) => {
          nodes.saveCropAreaImageNode.inputs.current_frame = frameIndex;
        }
      });
      const replacePreImageStep = defineStep({
        name: `replacePreImageStep`,
        preview: form.previewReplacePreImage,
        cacheParams: [form.replacePreImageOperations],
        inputSteps: { cropStep },
        create: (state, { inputs }) => {
          const { croppedImage } = inputs;
          const replacePreImage = operation_image.run(state, croppedImage, form.replacePreImageOperations);
          return {
            nodes: {},
            outputs: { replacePreImage }
          };
        },
        modify: ({ nodes, frameIndex }) => {
        }
      });
      const replaceMaskStep = defineStep({
        name: `replaceMaskStep`,
        preview: form.previewReplaceMask,
        cacheParams: [form.replaceMaskOperations],
        inputSteps: { replacePreImageStep },
        create: (state, { inputs }) => {
          const { replacePreImage } = inputs;
          const replaceMask = operation_mask.run(state, replacePreImage, void 0, form.replaceMaskOperations);
          const s = state.graph.Get_image_size({
            image: replacePreImage
          });
          const solidMask = state.graph.SolidMask({
            value: 1,
            width: s.outputs.INT,
            height: s.outputs.INT_1
          });
          const replaceMaskImage = state.graph.MaskToImage({
            mask: replaceMask ?? solidMask
          });
          const saveReplaceMaskImageNode = state.graph.RL$_SaveImageSequence({
            images: replaceMaskImage,
            current_frame: 0,
            path: `../input/${state.workingDirectory}/_replace-mask/#####.png`
          });
          return {
            nodes: {
              saveReplaceMaskImageNode
            },
            outputs: { replaceMask }
          };
        },
        modify: ({ nodes, frameIndex }) => {
          nodes.saveReplaceMaskImageNode.inputs.current_frame = frameIndex;
        }
      });
      const controlNetStackStep = (() => {
        let controlNetStepPrev = void 0;
        for (const c of form.controlNet) {
          const preprocessorKind = c.controlNet.toLowerCase().includes(`depth`) ? `zoe-depth` : c.controlNet.toLowerCase().includes(`normal`) ? `bae-normal` : c.controlNet.toLowerCase().includes(`sketch`) || c.controlNet.toLowerCase().includes(`canny`) ? `hed` : void 0;
          const preprocessorStep = defineStep({
            name: `preprocessorStep`,
            preview: c.preview,
            cacheParams: [preprocessorKind],
            inputSteps: { cropStep },
            create: ({ graph }, { inputs }) => {
              const { croppedImage } = inputs;
              const imagePre = preprocessorKind === `zoe-depth` ? graph.Zoe$7DepthMapPreprocessor({ image: croppedImage }).outputs.IMAGE : preprocessorKind === `bae-normal` ? graph.BAE$7NormalMapPreprocessor({ image: croppedImage }).outputs.IMAGE : preprocessorKind === `hed` ? graph.HEDPreprocessor({ image: croppedImage, safe: `enable`, version: `v1.1` }).outputs.IMAGE : croppedImage;
              return {
                nodes: {},
                outputs: { imagePre }
              };
            },
            modify: ({ nodes, frameIndex }) => {
            }
          });
          const controlNetStep = defineStep({
            name: `controlNetStep`,
            preview: c.preview,
            cacheParams: [],
            inputSteps: { preprocessorStep, controlNetStepPrev },
            create: ({ graph }, { inputs }) => {
              const { imagePre, controlNetStack: controlNetStackPrev } = inputs;
              console.log(`controlNetStep:`, { imagePre, controlNetStackPrev });
              const controlNetStack = graph.Control_Net_Stacker({
                cnet_stack: controlNetStackPrev,
                control_net: graph.ControlNetLoader({ control_net_name: c.controlNet }),
                image: imagePre,
                strength: c.strength,
                start_percent: c.start,
                end_percent: c.end
              }).outputs.CNET_STACK;
              return {
                nodes: {},
                outputs: { controlNetStack }
              };
            },
            modify: ({ nodes, frameIndex }) => {
            }
          });
          controlNetStepPrev = controlNetStep;
        }
        return controlNetStepPrev;
      })();
      const samplerStep_create = (iRepeat) => defineStep({
        name: `samplerStep`,
        preview: form.sampler.preview,
        cacheParams: [form.sampler, iRepeat],
        inputSteps: { cropStep, replaceMaskStep, controlNetStackStep },
        create: ({ graph }, { inputs }) => {
          const { croppedImage, replaceMask, controlNetStack } = inputs;
          if (form.sampler.previewInputs) {
            graph.PreviewImage({ images: croppedImage });
            if (replaceMask) {
              const maskImage = graph.MaskToImage({ mask: replaceMask });
              graph.PreviewImage({ images: maskImage });
            }
            throw new PreviewStopError(void 0);
          }
          const loraStack = !form.sampler.lcm ? void 0 : graph.LoRA_Stacker({
            input_mode: `simple`,
            lora_count: 1,
            lora_name_1: !form.sampler.sdxl ? `lcm-lora-sd.safetensors` : `lcm-lora-sdxl.safetensors`
          });
          const loader = graph.Efficient_Loader({
            ckpt_name: form.sampler.checkpoint,
            lora_stack: loraStack,
            cnet_stack: controlNetStack,
            // defaults
            lora_name: `None`,
            token_normalization: `none`,
            vae_name: `Baked VAE`,
            weight_interpretation: `comfy`,
            positive: form.sampler.positive,
            negative: form.sampler.negative
          });
          const startLatent = (() => {
            if (replaceMask && form.sampler.useImpaintingEncode) {
              const imageList = graph.ImpactImageBatchToImageList({
                image: croppedImage
              });
              let maskList = graph.MasksToMaskList({
                masks: replaceMask
              }).outputs.MASK;
              const latentList = graph.VAEEncodeForInpaint({ pixels: imageList, vae: loader, mask: maskList });
              return graph.RebatchLatents({
                latents: latentList
              });
            }
            const startLatent0 = graph.VAEEncode({ pixels: croppedImage, vae: loader });
            if (!replaceMask) {
              return startLatent0;
            }
            const startLatent1 = graph.SetLatentNoiseMask({ samples: startLatent0, mask: replaceMask });
            return startLatent1;
          })();
          let latent = startLatent._LATENT;
          if (form.sampler.previewLatent) {
            if (replaceMask) {
              const maskImage = graph.MaskToImage({ mask: replaceMask });
              graph.PreviewImage({ images: maskImage });
            }
            const latentImage = graph.VAEDecode({ samples: latent, vae: loader.outputs.VAE });
            graph.PreviewImage({ images: latentImage });
            throw new PreviewStopError(void 0);
          }
          const startStep = Math.max(
            0,
            Math.min(
              form.sampler.steps - 1,
              form.sampler.startStep ? form.sampler.startStep : form.sampler.startStepFromEnd ? form.sampler.steps - form.sampler.startStepFromEnd : 0
            )
          );
          const endStep = Math.max(
            1,
            Math.min(
              form.sampler.steps,
              form.sampler.endStep ? form.sampler.endStep : form.sampler.endStepFromEnd ? form.sampler.steps - form.sampler.endStepFromEnd : form.sampler.stepsToIterate ? startStep + form.sampler.stepsToIterate : form.sampler.steps
            )
          );
          const seed = form.sampler.seed;
          const sampler = graph.KSampler_Adv$5_$1Efficient$2({
            add_noise: form.sampler.add_noise ? `enable` : `disable`,
            return_with_leftover_noise: `disable`,
            vae_decode: `true`,
            preview_method: `auto`,
            noise_seed: seed + iRepeat,
            steps: form.sampler.steps,
            start_at_step: startStep,
            end_at_step: endStep,
            cfg: form.sampler.config,
            sampler_name: "lcm",
            scheduler: "normal",
            model: loader,
            positive: loader.outputs.CONDITIONING$6,
            //graph.CLIPTextEncode({ text: form.sampler.positive, clip: loader }),
            negative: loader.outputs.CONDITIONING$7,
            //graph.CLIPTextEncode({ text: form.sampler.positive, clip: loader }),
            // negative: graph.CLIPTextEncode({ text: '', clip: loader }),
            // latent_image: graph.EmptyLatentImage({ width: 512, height: 512, batch_size: 1 }),
            latent_image: startLatent
          });
          const finalImage = graph.VAEDecode({ samples: sampler, vae: loader }).outputs.IMAGE;
          graph.SaveImage({
            images: finalImage,
            filename_prefix: "cushy"
          });
          graph.PreviewImage({
            images: finalImage
          });
          return {
            nodes: {},
            outputs: { finalImage }
          };
        },
        modify: ({ nodes, frameIndex }) => {
        }
      });
      const samplerSteps = [...new Array(form.film?.singleFramePyramidSize ?? 1)].map((_, i) => samplerStep_create(i));
      let finalStep = samplerSteps[0];
      if (form.film?.singleFramePyramidSize) {
        const { singleFramePyramidSize } = form.film;
        finalStep = defineStep({
          name: `filmStep`,
          preview: form.film.preview,
          cacheParams: [singleFramePyramidSize],
          inputSteps: { samplerSteps },
          create: (state, { inputs }) => {
            const finalImages = samplerSteps.map((x) => () => x._build?.outputs.finalImage).filter((x) => x).map((x) => x);
            const { graph } = state;
            let images = finalImages[0];
            for (const f of finalImages.slice(1)) {
              images = graph.ImageBatch({
                image1: images,
                image2: f
              }).outputs.IMAGE;
            }
            const filmModel = graph.Load_Film_Model_$1mtb$2({
              film_model: `Style`
            });
            let oddFrames = images;
            for (let iLayer = 0; iLayer < singleFramePyramidSize - 1; iLayer++) {
              const filmFrames = graph.Film_Interpolation_$1mtb$2({
                film_model: filmModel,
                images: oddFrames,
                interpolate: 1
              });
              graph.SaveImage({
                images: filmFrames,
                filename_prefix: `film`
              });
              const filmframes_removedFirst = graph.ImageBatchRemove({
                images: filmFrames,
                index: 1
              });
              oddFrames = graph.VHS$_SelectEveryNthImage({
                images: filmframes_removedFirst,
                select_every_nth: 2
              }).outputs.IMAGE;
            }
            const interpolatedFrame = oddFrames;
            return {
              nodes: {},
              outputs: { finalImage: interpolatedFrame, interpolatedFrame }
            };
          },
          modify: ({ nodes, frameIndex }) => {
          }
        });
      }
      defineStep({
        name: `finalSave`,
        // preview: form.film.preview,
        cacheParams: [],
        inputSteps: { finalStep },
        create: (state, { inputs }) => {
          const { finalImage } = inputs;
          const { graph } = state;
          const saveImageNode = graph.RL$_SaveImageSequence({
            images: finalImage,
            current_frame: 0,
            path: `../input/${state.workingDirectory}/_final/#####.png`
          });
          return {
            nodes: { saveImageNode },
            outputs: { finalSavedImage: finalImage }
          };
        },
        modify: ({ nodes, frameIndex }) => {
          console.log(`finalSave: modify`, { frameIndex });
          nodes.saveImageNode.inputs.current_frame = frameIndex;
        }
      });
      const frameIndexes = [...new Array(form.imageSource.iterationCount)].map((_, i) => ({
        frameIndex: form.imageSource.startIndex + i * (form.imageSource.selectEveryNth ?? 1)
      }));
      let dependecyKeyRef = await runSteps(frameIndexes.map((x) => x.frameIndex));
      if (form.film?.sideFrameDoubleBackIterations) {
        const { sideFrameDoubleBackIterations } = form.film;
        console.log(`sideFrameDoubleBack START`);
        disableNodesAfterInclusive(runtime, 0);
        const {
          defineStep: defineStep2,
          runSteps: runSteps2,
          state: _state2
        } = createStepsSystem({
          runtime,
          imageDirectory: form.imageSource.directory.replace(/\/$/g, ``),
          graph: runtime.nodes,
          scopeStack: [{}]
        });
        const minCurrentFrame = Math.min(...frameIndexes.map((x) => x.frameIndex));
        const maxCurrentFrame = Math.max(...frameIndexes.map((x) => x.frameIndex));
        const size = 5;
        const sizeHalf = size / 2 | 0;
        defineStep2({
          name: `sideFrameDoubleBack`,
          // preview: form.film.preview,
          cacheParams: [sideFrameDoubleBackIterations, size, dependecyKeyRef.dependencyKey],
          inputSteps: {},
          create: (state, { inputs }) => {
            const { graph } = state;
            const loadImageBatchNode = graph.RL$_LoadImageSequence({
              path: `${state.workingDirectory}/_final/#####.png`,
              current_frame: 0,
              count: size
            });
            const filmModel = graph.Load_Film_Model_$1mtb$2({
              film_model: `Style`
            });
            let currentImages = loadImageBatchNode.outputs.image;
            for (let i = 0; i < sideFrameDoubleBackIterations; i++) {
              const filmFrames = graph.Film_Interpolation_$1mtb$2({
                film_model: filmModel,
                images: currentImages,
                interpolate: 1
              });
              const filmframes_removedFirst = graph.ImageBatchRemove({
                images: filmFrames,
                index: 1
              });
              const middleFrames = graph.VHS$_SelectEveryNthImage({
                images: filmframes_removedFirst,
                select_every_nth: 2
              });
              const middleFrames_withFirst = graph.ImageBatchJoin({
                images_a: graph.ImageBatchGet({
                  images: filmFrames,
                  index: 1
                }),
                images_b: middleFrames
              });
              const middleFrames_withFirstAndLast = graph.ImageBatchJoin({
                images_a: middleFrames_withFirst,
                images_b: graph.ImageBatchGet({
                  images: filmFrames,
                  index: graph.ImpactImageInfo({
                    value: filmFrames
                  }).outputs.batch
                })
              });
              const filmFrames2 = graph.Film_Interpolation_$1mtb$2({
                film_model: filmModel,
                images: middleFrames_withFirstAndLast,
                interpolate: 1
              });
              const filmframes2_removedFirst = graph.ImageBatchRemove({
                images: filmFrames2,
                index: 1
              });
              const middleFrames2 = graph.VHS$_SelectEveryNthImage({
                images: filmframes2_removedFirst,
                select_every_nth: 2
              });
              currentImages = middleFrames2.outputs.IMAGE;
            }
            graph.SaveImage({
              images: currentImages,
              filename_prefix: `film`
            });
            const mainImageNode = graph.ImageBatchGet({
              images: currentImages,
              index: sizeHalf + 1
            });
            const mainImage = mainImageNode.outputs.IMAGE;
            const saveImageNode = graph.RL$_SaveImageSequence({
              images: mainImage,
              current_frame: 0,
              path: `../input/${state.workingDirectory}/_final-film/#####.png`
            });
            return {
              nodes: { loadImageBatchNode, mainImageNode, saveImageNode },
              outputs: { mainImage }
            };
          },
          modify: ({ nodes, frameIndex }) => {
            const cStart = Math.max(minCurrentFrame, frameIndex - sizeHalf);
            const cEnd = Math.min(maxCurrentFrame, frameIndex + sizeHalf);
            const cCount = cEnd - cStart + 1;
            nodes.loadImageBatchNode.inputs.current_frame = cStart;
            nodes.loadImageBatchNode.inputs.count = cCount;
            nodes.mainImageNode.inputs.index = frameIndex - cStart + 1;
            nodes.saveImageNode.inputs.current_frame = frameIndex;
          }
        });
        dependecyKeyRef = await runSteps2(frameIndexes.map((x) => x.frameIndex));
      }
      if (form.upscale) {
        const formUpscale = form.upscale;
        console.log(`upscale START`);
        disableNodesAfterInclusive(runtime, 0);
        const finalDir = form.film?.sideFrameDoubleBackIterations ? `_final-film` : `_final`;
        const {
          defineStep: defineStep2,
          runSteps: runSteps2,
          state: _state2
        } = createStepsSystem({
          runtime,
          imageDirectory: form.imageSource.directory.replace(/\/$/g, ``),
          graph: runtime.nodes,
          scopeStack: [{}]
        });
        defineStep2({
          name: `upscale`,
          preview: formUpscale.preview,
          cacheParams: [formUpscale, dependecyKeyRef.dependencyKey],
          inputSteps: {},
          create: (state, { inputs }) => {
            const { graph } = state;
            const loadImageNode = graph.RL$_LoadImageSequence({
              path: `${state.workingDirectory}/${finalDir}/#####.png`,
              current_frame: 0
            });
            const controlNetStack = formUpscale.sdxl ? void 0 : graph.Control_Net_Stacker({
              control_net: graph.ControlNetLoader({
                control_net_name: `control_v11f1e_sd15_tile.pth`
              }),
              image: loadImageNode,
              strength: formUpscale.tileStrength
            });
            const loraStack = !formUpscale.lcm ? void 0 : graph.LoRA_Stacker({
              input_mode: `simple`,
              lora_count: 1,
              lora_name_1: !formUpscale.sdxl ? `lcm-lora-sd.safetensors` : `lcm-lora-sdxl.safetensors`
            });
            const loader = graph.Efficient_Loader({
              ckpt_name: formUpscale.checkpoint,
              cnet_stack: controlNetStack,
              lora_stack: loraStack,
              // defaults
              lora_name: `None`,
              token_normalization: `none`,
              vae_name: `Baked VAE`,
              weight_interpretation: `comfy`,
              positive: form.sampler.positive,
              negative: form.sampler.negative
            });
            const upscaleNode = graph.UltimateSDUpscale({
              image: loadImageNode,
              force_uniform_tiles: `enable`,
              mode_type: `Linear`,
              seam_fix_mode: `None`,
              model: loader,
              vae: loader,
              positive: loader.outputs.CONDITIONING$6,
              negative: loader.outputs.CONDITIONING$7,
              upscale_model: graph.UpscaleModelLoader({
                model_name: `8x_NMKD-Superscale_150000_G.pth`
              }),
              sampler_name: formUpscale.lcm ? `lcm` : `dpmpp_2m_sde_gpu`,
              scheduler: formUpscale.lcm ? `normal` : `karras`,
              denoise: formUpscale.denoise,
              cfg: formUpscale.config,
              seed: form.sampler.seed,
              tile_width: formUpscale.sdxl ? (form.sizeWidth ?? 1024) * formUpscale.upscaleBy : 576,
              tile_height: formUpscale.sdxl ? (form.sizeHeight ?? 1024) * formUpscale.upscaleBy : 768,
              steps: formUpscale.steps,
              // tile_width: 1536,
              // tile_height: 2048,
              upscale_by: formUpscale.upscaleBy
            });
            const upscaledImage = upscaleNode.outputs.IMAGE;
            graph.SaveImage({
              images: upscaledImage,
              filename_prefix: `upscale`
            });
            const saveImageNode = graph.RL$_SaveImageSequence({
              images: upscaledImage,
              current_frame: 0,
              path: `../input/${state.workingDirectory}/_final-upscale/#####.png`
            });
            return {
              nodes: { loadImageNode, saveImageNode },
              outputs: { upscaledImage }
            };
          },
          modify: ({ nodes, frameIndex }) => {
            nodes.loadImageNode.inputs.current_frame = frameIndex;
            nodes.saveImageNode.inputs.current_frame = frameIndex;
          }
        });
        dependecyKeyRef = await runSteps2(frameIndexes.map((x) => x.frameIndex));
      }
      if (form.uncrop) {
        const formUncrop = form.uncrop;
        console.log(`uncrop START`);
        disableNodesAfterInclusive(runtime, 0);
        const startDir = `_start-image`;
        const finalDir = form.upscale ? `_final-upscale` : form.film?.sideFrameDoubleBackIterations ? `_final-film` : `_final`;
        const cropAreaDir = `_crop-area`;
        const replaceMaskDir = `_replace-mask`;
        const {
          defineStep: defineStep2,
          runSteps: runSteps2,
          state: _state2
        } = createStepsSystem({
          runtime,
          imageDirectory: form.imageSource.directory.replace(/\/$/g, ``),
          graph: runtime.nodes,
          scopeStack: [{}]
        });
        defineStep2({
          name: `upscale`,
          preview: formUncrop.preview,
          cacheParams: [formUncrop, dependecyKeyRef.dependencyKey],
          inputSteps: {},
          create: (state, { inputs }) => {
            const { graph } = state;
            const loadStartImageNode = graph.RL$_LoadImageSequence({
              path: `${state.workingDirectory}/${startDir}/#####.png`,
              current_frame: 0
            });
            const loadFinalImageNode = graph.RL$_LoadImageSequence({
              path: `${state.workingDirectory}/${finalDir}/#####.png`,
              current_frame: 0
            });
            const loadCropAreaImageNode = graph.RL$_LoadImageSequence({
              path: `${state.workingDirectory}/${cropAreaDir}/#####.png`,
              current_frame: 0
            });
            const loadReplaceMaskImageNode = graph.RL$_LoadImageSequence({
              path: `${state.workingDirectory}/${replaceMaskDir}/#####.png`,
              current_frame: 0
            });
            const uncroppedReplaceMaskImage = graph.Paste_By_Mask({
              image_base: loadCropAreaImageNode,
              image_to_paste: loadReplaceMaskImageNode,
              mask: loadCropAreaImageNode,
              resize_behavior: `resize`
            }).outputs.IMAGE;
            const uncroppedFinalImage = graph.Paste_By_Mask({
              image_base: loadStartImageNode,
              image_to_paste: loadFinalImageNode,
              mask: loadCropAreaImageNode,
              resize_behavior: `resize`
            }).outputs.IMAGE;
            const restoredImage = graph.Image_Blend_by_Mask({
              image_a: loadStartImageNode,
              image_b: uncroppedFinalImage,
              mask: uncroppedReplaceMaskImage,
              blend_percentage: 1
            }).outputs.IMAGE;
            const uncroppedImage = restoredImage;
            graph.SaveImage({
              images: uncroppedImage,
              filename_prefix: `uncropped`
            });
            return {
              nodes: { loadStartImageNode, loadFinalImageNode, loadCropAreaImageNode, loadReplaceMaskImageNode },
              outputs: { uncroppedImage, uncroppedReplaceMaskImage, uncroppedFinalImage }
            };
          },
          modify: ({ nodes, frameIndex }) => {
            nodes.loadStartImageNode.inputs.current_frame = frameIndex;
            nodes.loadFinalImageNode.inputs.current_frame = frameIndex;
            nodes.loadCropAreaImageNode.inputs.current_frame = frameIndex;
            nodes.loadReplaceMaskImageNode.inputs.current_frame = frameIndex;
          }
        });
        dependecyKeyRef = await runSteps2(frameIndexes.map((x) => x.frameIndex));
      }
      return;
    } catch (err) {
      if (err instanceof PreviewStopError) {
        await runtime.PROMPT();
        return;
      }
      throw err;
    }
  }
});
