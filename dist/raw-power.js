// ▄████████ ███    █▄     ▄████████    ▄█    █▄    ▄██   ▄           ▄████████    ▄███████▄    ▄███████▄
// ███    ███ ███    ███   ███    ███   ███    ███   ███   ██▄        ███    ███   ███    ███   ███    ███
// ███    █▀  ███    ███   ███    █▀    ███    ███   ███▄▄▄███        ███    ███   ███    ███   ███    ███
// ███        ███    ███   ███         ▄███▄▄▄▄███▄▄ ▀▀▀▀▀▀███        ███    ███   ███    ███   ███    ███
// ███        ███    ███ ▀███████████ ▀▀███▀▀▀▀███▀  ▄██   ███      ▀███████████ ▀█████████▀  ▀█████████▀
// ███    █▄  ███    ███          ███   ███    ███   ███   ███        ███    ███   ███          ███
// ███    ███ ███    ███    ▄█    ███   ███    ███   ███   ███        ███    ███   ███          ███
// ████████▀  ████████▀   ▄████████▀    ███    █▀     ▀█████▀         ███    █▀   ▄████▀       ▄████▀

// library/ricklove/my-cushy-deck/src/_maskPrefabs.ts
var StopError = class extends Error {
};
var storeInScope = (state, name, value) => {
  const { scopeStack } = state;
  scopeStack[scopeStack.length - 1][name] = value;
};
var loadFromScope = (state, name) => {
  const { scopeStack } = state;
  let i = scopeStack.length;
  while (i >= 0) {
    const v = scopeStack[scopeStack.length - 1][name];
    if (v !== void 0) {
      return v;
    }
  }
  return void 0;
};
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
  run: async ({ flow, graph }, image, mask, form) => {
    if (form.clipSeg == null) {
      return mask;
    }
    const clipMask = graph.CLIPSeg({
      image,
      text: form.clipSeg.prompt,
      threshold: form.clipSeg.threshold,
      dilation_factor: form.clipSeg.dilation,
      blur: form.clipSeg.blur
    });
    return clipMask.outputs.Mask;
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
  run: async ({ flow, graph }, image, mask, form) => {
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
    });
    return dilated.outputs.MASKS;
  }
});
var operation_erodeOrDilate = createMaskOperation({
  ui: (form) => ({
    erodeOrDilate: form.intOpt({ min: -64, max: 64 })
  }),
  run: async ({ flow, graph }, image, mask, form) => {
    if (form.erodeOrDilate == null) {
      return mask;
    }
    if (!mask) {
      return mask;
    }
    const maskDilated = form.erodeOrDilate > 0 ? graph.Mask_Dilate_Region({ masks: mask, iterations: form.erodeOrDilate }) : form.erodeOrDilate < 0 ? graph.Mask_Erode_Region({ masks: mask, iterations: -form.erodeOrDilate }) : mask;
    return maskDilated;
  }
});
var operation_segment = createMaskOperation({
  ui: (form) => ({
    segmentIndex: form.intOpt({ min: 0, max: 10 })
  }),
  run: async ({ flow, graph }, image, mask, form) => {
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
    mask = graph.SegsToCombinedMask({ segs: segsFilter.outputs.filtered_SEGS });
    return mask;
  }
});
var operation_sam = createMaskOperation({
  ui: (form) => ({
    sam: form.groupOpt({
      items: () => ({
        // prompt: form.str({ default: `ball` }),
        threshold: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 })
        // dilation: form.int({ default: 4, min: 0 }),
        // blur: form.float({ default: 1, min: 0 }),
      })
    })
  }),
  run: async ({ flow, graph }, image, mask, form) => {
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
      detection_hint: `center-1`,
      mask_hint_use_negative: `False`,
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
  run: async (state, image, mask, form) => {
    if (form.storeMask == null) {
      return mask;
    }
    storeInScope(state, form.storeMask.name, mask ?? null);
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
  run: async (state, image, mask, form) => {
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
  });
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
  run: async (state, imageBatch, maskBatch, form) => {
    const { flow, graph } = state;
    const image = graph.ImpactImageBatchToImageList({
      image: imageBatch
    });
    let mask = !maskBatch ? void 0 : graph.MasksToMaskList({
      masks: maskBatch
    }).outputs.MASK;
    for (const op of form.maskOperations) {
      mask = await operation_clipSeg.run(state, image, mask, op);
      mask = await operation_color.run(state, image, mask, op);
      mask = await operation_segment.run(state, image, mask, op);
      mask = await operation_sam.run(state, image, mask, op);
      mask = await operation_erodeOrDilate.run(state, image, mask, op);
      mask = await operation_storeMask.run(state, image, mask, op);
      mask = await operation_combineMasks.run(state, image, mask, op);
      if (op.preview) {
        if (!mask) {
          flow.print(`No mask!`);
          throw new StopError();
        }
        const maskAsImage = graph.MaskToImage({ mask });
        const maskPreview = graph.ImageBlend({
          image1: maskAsImage,
          image2: image,
          blend_mode: `normal`,
          blend_factor: 0.5
        });
        graph.PreviewImage({ images: maskPreview });
        await flow.PROMPT();
        throw new StopError();
      }
    }
    const maskBatchFinal = !mask ? void 0 : graph.MaskListToMaskBatch({
      mask
    });
    return maskBatchFinal;
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

// library/ricklove/my-cushy-deck/raw-power.ts
appOptimized({
  ui: (form) => ({
    // workingDirectory: form.str({}),
    // startImage: form.image({}),
    imageSource: form.group({
      items: () => ({
        directory: form.string({}),
        // pattern: form.string({ default: `*.png` }),
        startIndex: form.int({ default: 0, min: 0 }),
        endIndex: form.intOpt({ default: 1e4, min: 0, max: 1e4 }),
        selectEveryNth: form.intOpt({ default: 1, min: 1 }),
        batchSize: form.int({ default: 1, min: 1 }),
        iterationCount: form.int({ default: 1, min: 1 }),
        iterationSize: form.intOpt({ default: 1, min: 1 }),
        preview: form.inlineRun({})
      })
    }),
    _1: form.markdown({
      markdown: () => `# Crop Image`
    }),
    // crop1:
    cropMaskOperations: operation_mask.ui(form),
    cropPadding: form.int({ default: 64 }),
    size: form.choice({
      items: () => ({
        common: form.selectOne({
          default: { id: `512` },
          choices: [{ id: `384` }, { id: `512` }, { id: `768` }, { id: `1024` }, { id: `1280` }, { id: `1920` }]
        }),
        custom: form.number({ default: 512, min: 32, max: 8096 })
      })
    }),
    previewCrop: form.inlineRun({}),
    _2: form.markdown({
      markdown: () => `# Mask Replacement`
    }),
    //operation_mask.ui(form).maskOperations,
    replaceMaskOperations: operation_mask.ui(form),
    // ...operation_replaceMask.ui(form),
    // mask: ui_maskPrompt(form, { defaultPrompt: `ball` }),
    _3: form.markdown({ markdown: (formRoot) => `# Generate Image` }),
    useImpaintingEncode: form.bool({ default: false }),
    previewLatent: form.inlineRun({}),
    // g: form.groupOpt({
    //     items: () => ({
    positive: form.str({}),
    negative: form.str({}),
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
    config: form.float({ default: 1.5 }),
    add_noise: form.bool({ default: true }),
    render: form.inlineRun({}),
    testSeed: form.seed({}),
    test: form.custom({
      Component: OptimizerComponent,
      defaultValue: () => ({})
    })
  }),
  run: async (flow, form) => {
    const iterate = async (batchIndex) => {
      flow.print(`${JSON.stringify(form)}`);
      const graph = flow.nodes;
      const state = { flow, graph, scopeStack: [{}] };
      const startImageBatch = graph.VHS$_LoadImagesPath({
        directory: form.imageSource.directory,
        image_load_cap: form.imageSource.batchSize,
        skip_first_images: form.imageSource.startIndex + batchIndex * (form.imageSource.iterationSize ?? form.imageSource.batchSize) * (form.imageSource.selectEveryNth ?? 1),
        select_every_nth: form.imageSource.selectEveryNth ?? 1
      }).outputs.IMAGE;
      if (form.imageSource.preview) {
        graph.PreviewImage({ images: startImageBatch });
        await flow.PROMPT();
        throw new StopError();
      }
      const cropMaskBatch = await operation_mask.run(state, startImageBatch, void 0, form.cropMaskOperations);
      const { size: sizeInput, cropPadding } = form;
      const size = typeof sizeInput === `number` ? sizeInput : Number(sizeInput.id);
      const croppedImageBatch = !cropMaskBatch ? startImageBatch : graph.RL$_Crop$_Resize({
        image: startImageBatch,
        mask: cropMaskBatch,
        max_side_length: size,
        padding: cropPadding
      }).outputs.cropped_image;
      if (form.previewCrop) {
        graph.PreviewImage({ images: startImageBatch });
        if (cropMaskBatch) {
          const maskImage = graph.MaskToImage({ mask: cropMaskBatch });
          graph.PreviewImage({ images: maskImage });
        }
        graph.PreviewImage({ images: croppedImageBatch });
        await flow.PROMPT();
        throw new StopError();
      }
      const replaceMaskBatch = await operation_mask.run(state, croppedImageBatch, void 0, form.replaceMaskOperations);
      const loraStack = !form.lcm ? void 0 : graph.LoRA_Stacker({
        input_mode: `simple`,
        lora_count: 1,
        lora_name_1: !form.sdxl ? `lcm-lora-sd.safetensors` : `lcm-lora-sdxl.safetensors`
      });
      let controlNetStack = void 0;
      for (const c of form.controlNet) {
        const imagePre = c.controlNet.toLowerCase().includes(`depth`) ? graph.Zoe$7DepthMapPreprocessor({ image: croppedImageBatch }) : c.controlNet.toLowerCase().includes(`normal`) ? graph.BAE$7NormalMapPreprocessor({ image: croppedImageBatch }) : croppedImageBatch;
        if (c.preview) {
          graph.PreviewImage({ images: imagePre });
          await flow.PROMPT();
          throw new StopError();
        }
        controlNetStack = graph.Control_Net_Stacker({
          cnet_stack: controlNetStack,
          control_net: graph.ControlNetLoader({ control_net_name: c.controlNet }),
          image: imagePre,
          strength: c.strength,
          start_percent: c.start,
          end_percent: c.end
        });
      }
      const loader = graph.Efficient_Loader({
        ckpt_name: form.checkpoint,
        lora_stack: loraStack,
        cnet_stack: controlNetStack,
        // defaults
        lora_name: `None`,
        token_normalization: `none`,
        vae_name: `Baked VAE`,
        weight_interpretation: `comfy`,
        positive: form.positive,
        negative: form.negative
      });
      const startLatent = (() => {
        if (replaceMaskBatch && form.useImpaintingEncode) {
          const imageList = graph.ImpactImageBatchToImageList({
            image: croppedImageBatch
          });
          let maskList = graph.MasksToMaskList({
            masks: replaceMaskBatch
          }).outputs.MASK;
          const latentList = graph.VAEEncodeForInpaint({ pixels: imageList, vae: loader, mask: maskList });
          return graph.RebatchLatents({
            latents: latentList
          });
        }
        const startLatent0 = graph.VAEEncode({ pixels: croppedImageBatch, vae: loader });
        if (!replaceMaskBatch) {
          return startLatent0;
        }
        const startLatent1 = graph.SetLatentNoiseMask({ samples: startLatent0, mask: replaceMaskBatch });
        return startLatent1;
      })();
      let latent = startLatent._LATENT;
      if (form.previewLatent) {
        if (replaceMaskBatch) {
          const maskImage = graph.MaskToImage({ mask: replaceMaskBatch });
          graph.PreviewImage({ images: maskImage });
        }
        const latentImage = graph.VAEDecode({ samples: latent, vae: loader.outputs.VAE });
        graph.PreviewImage({ images: latentImage });
        await flow.PROMPT();
        throw new StopError();
      }
      const seed = flow.randomSeed();
      const startStep = Math.max(
        0,
        Math.min(
          form.steps - 1,
          form.startStep ? form.startStep : form.startStepFromEnd ? form.steps - form.startStepFromEnd : 0
        )
      );
      const endStep = Math.max(
        1,
        Math.min(
          form.steps,
          form.endStep ? form.endStep : form.endStepFromEnd ? form.steps - form.endStepFromEnd : form.stepsToIterate ? startStep + form.stepsToIterate : form.steps
        )
      );
      const sampler = graph.KSampler_Adv$5_$1Efficient$2({
        add_noise: form.add_noise ? `enable` : `disable`,
        return_with_leftover_noise: `disable`,
        vae_decode: `true`,
        preview_method: `auto`,
        noise_seed: seed,
        steps: form.steps,
        start_at_step: startStep,
        end_at_step: endStep,
        cfg: form.config,
        sampler_name: "lcm",
        scheduler: "normal",
        model: loader,
        positive: loader.outputs.CONDITIONING$6,
        //graph.CLIPTextEncode({ text: form.positive, clip: loader }),
        negative: loader.outputs.CONDITIONING$7,
        //graph.CLIPTextEncode({ text: form.positive, clip: loader }),
        // negative: graph.CLIPTextEncode({ text: '', clip: loader }),
        // latent_image: graph.EmptyLatentImage({ width: 512, height: 512, batch_size: 1 }),
        latent_image: startLatent
      });
      graph.SaveImage({
        images: graph.VAEDecode({ samples: sampler, vae: loader }),
        filename_prefix: "ComfyUI"
      });
      const result = await flow.PROMPT();
    };
    for (let i = 0; i < form.imageSource.iterationCount; i++) {
      try {
        await iterate(i);
      } catch (err) {
        if (err instanceof StopError) {
          return;
        }
        throw err;
      }
    }
  }
});
