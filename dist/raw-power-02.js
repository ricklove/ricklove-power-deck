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
var storeInScope = (state, name, kind, value) => {
  const { scopeStack } = state;
  scopeStack[scopeStack.length - 1][name] = value == void 0 ? void 0 : { value, kind };
  console.log(`storeInScope`, { scopeStack });
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

// library/ricklove/my-cushy-deck/src/_operations/_frame.ts
var createFrameIdProvider = (frameIds) => {
  const getBatch = (frameIds2, currentFrameId, leftCount, rightCount) => {
    const iFrameId = frameIds2.indexOf(currentFrameId);
    const iStart = Math.max(0, iFrameId - leftCount);
    const iEndInclusive = Math.min(frameIds2.length - 1, iFrameId + (rightCount ?? leftCount));
    return [...new Array(iEndInclusive - iStart + 1)].map((_, i) => frameIds2[iStart + i]);
  };
  const frameIdProvider = {
    _frameIds: frameIds,
    _currentFrameId: 0,
    _callbacks: [],
    subscribe: (callback) => {
      frameIdProvider._callbacks.push(callback);
    },
    set: (value) => {
      frameIdProvider._currentFrameId = value;
      for (const cb of frameIdProvider._callbacks) {
        try {
          cb(value);
        } catch (err) {
          console.error(`frameIdProvider.callback error`, err);
        }
      }
    },
    get: () => {
      console.log(`frameIdProvider.get`, { frameIdProvider });
      return frameIdProvider._currentFrameId;
    },
    getBatch: (left, right) => getBatch(frameIdProvider._frameIds, frameIdProvider._currentFrameId, left, right)
  };
  return frameIdProvider;
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
                  __loadVariables: form.groupOpt({
                    items: () => ({
                      image: form.stringOpt({ default: `a` }),
                      mask: form.stringOpt({ default: `a` })
                    })
                  }),
                  ...v.ui(form),
                  __storeVariables: form.groupOpt({
                    items: () => ({
                      image: form.stringOpt({ default: `a` }),
                      mask: form.stringOpt({ default: `a` })
                    })
                  }),
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
    for (const listItem of form) {
      const listItemGroupOptFields = listItem;
      for (const [opName, op] of Object.entries(operations)) {
        const opGroupOptValue = listItemGroupOptFields[opName];
        if (opGroupOptValue == null) {
          continue;
        }
        frame = { ...frame };
        if (opGroupOptValue.__loadVariables?.image) {
          frame.image = loadFromScope(state, opGroupOptValue.__loadVariables.image) ?? frame.image;
        }
        if (opGroupOptValue.__loadVariables?.mask) {
          frame.mask = loadFromScope(state, opGroupOptValue.__loadVariables.mask) ?? frame.mask;
        }
        frame = {
          ...frame,
          ...op.run(state, opGroupOptValue, frame)
        };
        if (opGroupOptValue.__storeVariables?.image) {
          storeInScope(state, opGroupOptValue.__storeVariables.image, `image`, frame.image);
        }
        if (opGroupOptValue.__storeVariables?.mask) {
          storeInScope(state, opGroupOptValue.__storeVariables.mask, `mask`, frame.mask);
        }
        if (opGroupOptValue.__preview) {
          graph.PreviewImage({
            images: graph.ImageBatch({
              image1: graph.MaskToImage({ mask: frame.mask }),
              image2: graph.ImageBatch({
                image1: graph.ImageBlend({
                  image1: frame.image,
                  image2: graph.MaskToImage({ mask: frame.mask }),
                  blend_mode: `normal`,
                  blend_factor: 0.5
                }),
                image2: frame.image
              })
            })
          });
          throw new PreviewStopError(void 0);
        }
      }
    }
    return frame;
  }
});

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

// library/ricklove/my-cushy-deck/src/_operations/_frameCached.ts
var CacheStopError = class extends Error {
  constructor(onCacheCreated, wasAlreadyCached) {
    super();
    this.onCacheCreated = onCacheCreated;
    this.wasAlreadyCached = wasAlreadyCached;
  }
};
var createFrameOperationValue_cached = (op) => op;
var createFrameOperationsChoiceList_cached = (operations) => createFrameOperationValue_cached({
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
    const opCacheState = {
      dependencyKey: `42`,
      cacheStepIndex: frame.cacheStepIndex_current
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
      const dependencyKey = opCacheState.dependencyKey = `${createRandomGenerator(
        `${opCacheState.dependencyKey}:${JSON.stringify(cleanedFormItem)}`
      ).randomInt()}`;
      const shouldCache = true;
      const cacheStepIndex = !shouldCache ? opCacheState.cacheStepIndex : opCacheState.cacheStepIndex = opCacheState.cacheStepIndex + 1;
      const isCached = state.cacheState.exists(cacheStepIndex, dependencyKey, frame.cacheFrameId);
      return {
        item: x,
        dependencyKey,
        cacheStepIndex,
        shouldCache,
        isCached
      };
    });
    const opStatesWithRequired = opStates.map((x, i) => ({
      ...x,
      isRequired: !opStates[i + 1]?.isCached,
      isLast: i === opStates.length - 1
    }));
    for (const {
      item: listItem,
      dependencyKey,
      isCached,
      cacheStepIndex,
      shouldCache,
      isLast,
      isRequired
    } of opStatesWithRequired) {
      if (isCached) {
        if (isRequired) {
          const cacheResult = state.cacheState.get(cacheStepIndex, dependencyKey, frame.cacheFrameId);
          if (!cacheResult) {
            throw new Error(
              `Cache is missing, but reported as existing ${JSON.stringify({ cacheStepIndex, listItem })}`
            );
          }
          frame = { ...frame, ...cacheResult.frame };
          state.scopeStack = cacheResult.scopeStack;
        }
        if (cacheStepIndex >= frame.cacheStepIndex_stop) {
          throw new CacheStopError(() => {
          }, true);
        }
        continue;
      }
      console.log(`createFrameOperationsChoiceList: NOT CACHED ${frame.cacheStepIndex_stop}@${frame.cacheFrameId}`, {
        opStatesWithRequired
      });
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
      if (shouldCache) {
        const { onCacheCreated } = state.cacheState.set(cacheStepIndex, dependencyKey, frame.cacheFrameId, {
          frame,
          scopeStack: state.scopeStack
        });
        frame = {
          ...frame,
          cacheStepIndex_current: cacheStepIndex
        };
        if (cacheStepIndex >= frame.cacheStepIndex_stop) {
          throw new CacheStopError(onCacheCreated, false);
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
var upscaleWithModel = createFrameOperation({
  ui: (form) => ({
    model: form.enum({
      enumName: `Enum_UpscaleModelLoader_model_name`,
      default: `8x_NMKD-Superscale_150000_G.pth`
    }),
    resize: form.choice({
      items: () => ({
        none: form.bool({ default: false }),
        ratio: form.float({ default: 1 }),
        maxSideLength: form.int({ default: 1024 })
        // targetWidth: form.int({ default: 1024 }),
        // targetHeight: form.int({ default: 1024 }),
      })
    })
  }),
  run: ({ graph }, form, { image, mask }) => {
    const upscaledImage = graph.ImageUpscaleWithModel({
      image,
      upscale_model: graph.UpscaleModelLoader({
        model_name: form.model
      })
    }).outputs.IMAGE;
    const resizedImage = form.resize.ratio ? graph.ImageTransformResizeRelative({
      images: upscaledImage,
      method: `lanczos`,
      scale_width: form.resize.ratio,
      scale_height: form.resize.ratio
    }) : form.resize.maxSideLength ? graph.RL$_Crop$_Resize({
      image: upscaledImage,
      max_side_length: form.resize.maxSideLength
    }) : upscaledImage;
    const size = graph.Get_image_size({ image: resizedImage });
    const resizedMask = graph.Image_To_Mask({
      method: `intensity`,
      image: graph.ImageTransformResizeAbsolute({
        images: graph.MaskToImage({ mask }),
        method: `lanczos`,
        width: size.outputs.INT,
        height: size.outputs.INT_1
      })
    }).outputs.MASK;
    return { image: resizedImage, mask: resizedMask };
  }
});
var resizingOperations = {
  cropResizeByMask,
  upscaleWithModel
};
var resizingOperationsList = createFrameOperationsGroupList(resizingOperations);

// library/ricklove/my-cushy-deck/src/_operations/sampling.ts
var sampler = createFrameOperation({
  ui: (form) => ({
    useImpaintingEncode: form.bool({ default: false }),
    previewLatent: form.inlineRun({}),
    add_noise: form.bool({ default: true }),
    controlNet: form.list({
      element: () => form.group({
        items: () => ({
          enabled: form.bool({ default: true }),
          controlNet: form.enum({
            enumName: "Enum_ControlNetLoader_control_net_name",
            default: "sdxl-depth-mid.safetensors"
          }),
          strength: form.float({ default: 1, min: 0, max: 1, step: 0.01 }),
          start: form.float({ default: 0, min: 0, max: 1, step: 0.01 }),
          end: form.float({ default: 0, min: 0, max: 1, step: 0.01 }),
          imageVariable: form.stringOpt({}),
          preview: form.inlineRun({})
        })
      })
    }),
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
    config: form.float({ default: 1.5 })
  }),
  run: (state, form, frame) => {
    const { runtime, graph } = state;
    const { image, mask } = frame;
    const startImage = image;
    const replaceMask = mask;
    let controlNetStack = void 0;
    for (const c of form.controlNet) {
      if (!c.enabled) {
        continue;
      }
      const image2 = loadFromScope(state, c.imageVariable ?? ``) ?? startImage;
      if (c.preview) {
        graph.PreviewImage({ images: image2 });
        throw new PreviewStopError(void 0);
      }
      controlNetStack = graph.Control_Net_Stacker({
        cnet_stack: controlNetStack,
        control_net: graph.ControlNetLoader({ control_net_name: c.controlNet }),
        image: image2,
        strength: c.strength,
        start_percent: c.start,
        end_percent: c.end
      }).outputs.CNET_STACK;
    }
    const loraStack = !form.lcm ? void 0 : graph.LoRA_Stacker({
      input_mode: `simple`,
      lora_count: 1,
      lora_name_1: !form.sdxl ? `lcm-lora-sd.safetensors` : `lcm-lora-sdxl.safetensors`
    }).outputs.LORA_STACK;
    const loader = graph.Efficient_Loader({
      ckpt_name: form.checkpoint,
      cnet_stack: controlNetStack,
      lora_stack: loraStack,
      // defaults
      lora_name: `None`,
      token_normalization: `none`,
      vae_name: `Baked VAE`,
      weight_interpretation: `comfy`,
      positive: form.positive,
      negative: form.negative
    });
    const startLatent = (() => {
      if (replaceMask && form.useImpaintingEncode) {
        const imageList = graph.ImpactImageBatchToImageList({
          image: startImage
        });
        let maskList = graph.MasksToMaskList({
          masks: replaceMask
        }).outputs.MASK;
        const latentList = graph.VAEEncodeForInpaint({ pixels: imageList, vae: loader, mask: maskList });
        return graph.RebatchLatents({
          latents: latentList
        });
      }
      const startLatent0 = graph.VAEEncode({ pixels: startImage, vae: loader });
      if (!replaceMask) {
        return startLatent0;
      }
      const startLatent1 = graph.SetLatentNoiseMask({ samples: startLatent0, mask: replaceMask });
      return startLatent1;
    })();
    let latent = startLatent._LATENT;
    if (form.previewLatent) {
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
    const seed = form.seed;
    const sampler2 = graph.KSampler_Adv$5_$1Efficient$2({
      add_noise: form.add_noise ? `enable` : `disable`,
      return_with_leftover_noise: `disable`,
      vae_decode: `false`,
      preview_method: `none`,
      noise_seed: seed,
      steps: form.steps,
      start_at_step: startStep,
      end_at_step: endStep,
      cfg: form.config,
      sampler_name: form.lcm ? "lcm" : `dpmpp_3m_sde_gpu`,
      scheduler: form.lcm ? "normal" : `karras`,
      model: loader,
      positive: loader.outputs.CONDITIONING$6,
      //graph.CLIPTextEncode({ text: form.positive, clip: loader }),
      negative: loader.outputs.CONDITIONING$7,
      //graph.CLIPTextEncode({ text: form.positive, clip: loader }),
      // negative: graph.CLIPTextEncode({ text: '', clip: loader }),
      // latent_image: graph.EmptyLatentImage({ width: 512, height: 512, batch_size: 1 }),
      latent_image: startLatent
    });
    const finalImage = graph.VAEDecode({ samples: sampler2, vae: loader }).outputs.IMAGE;
    return { image: finalImage };
  }
});
var samplingOperations = {
  sampler
};
var samplingOperationsList = createFrameOperationsGroupList(samplingOperations);

// library/ricklove/my-cushy-deck/src/_operations/files.ts
var saveImageFrame = createFrameOperation({
  ui: (form) => ({
    path: form.string({ default: `../input/working/#####.png` })
  }),
  run: ({ graph }, form, { image, frameIdProvider }) => {
    const saveNode = graph.RL$_SaveImageSequence({
      images: image,
      current_frame: 0,
      path: form.path
    });
    frameIdProvider.subscribe((v) => saveNode.inputs.current_frame = v);
    return {};
  }
});
var loadImageFrame = createFrameOperation({
  ui: (form) => ({
    path: form.string({ default: `../input/working/#####.png` })
  }),
  run: ({ graph }, form, { image, frameIdProvider }) => {
    const resultImageNode = graph.RL$_LoadImageSequence({
      current_frame: 0,
      path: form.path
    });
    frameIdProvider.subscribe((v) => resultImageNode.inputs.current_frame = v);
    return { image: resultImageNode.outputs.image };
  }
});
var cacheImageFrame = createFrameOperation({
  ui: (form) => ({
    buildCache: form.inlineRun({ text: `Cache It!!!`, kind: `warning` }),
    path: form.string({ default: `../input/working/NAME/#####.png` }),
    image: form.strOpt({ default: `imageFinal` }),
    imageVariables: form.list({
      element: () => form.string({ default: `imageVariable` })
    }),
    mask: form.strOpt({ default: `maskFinal` }),
    maskVariables: form.list({
      element: () => form.string({ default: `maskVariable` })
    })
  }),
  run: (state, form, { image, mask, frameIdProvider }) => {
    const { graph } = state;
    const createCachedImage = (name, image2) => {
      if (form.buildCache) {
        const saveNode = graph.RL$_SaveImageSequence({
          images: image2,
          current_frame: 0,
          path: form.path.replace(`NAME`, name)
        });
        frameIdProvider.subscribe((v) => saveNode.inputs.current_frame = v);
        return void 0;
      }
      const cachedImageNode = graph.RL$_LoadImageSequence({
        current_frame: 0,
        path: form.path.replace(`NAME`, name)
      });
      frameIdProvider.subscribe((v) => cachedImageNode.inputs.current_frame = v);
      return cachedImageNode.outputs.image;
    };
    const createCachedMask = (name, mask2) => {
      if (form.buildCache) {
        const saveNode = graph.RL$_SaveImageSequence({
          images: graph.MaskToImage({ mask: mask2 }),
          current_frame: 0,
          path: form.path.replace(`NAME`, name)
        });
        frameIdProvider.subscribe((v) => saveNode.inputs.current_frame = v);
        return void 0;
      }
      const cachedImageNode = graph.RL$_LoadImageSequence({
        current_frame: 0,
        path: form.path.replace(`NAME`, name)
      });
      frameIdProvider.subscribe((v) => cachedImageNode.inputs.current_frame = v);
      const cachedMask = graph.Image_To_Mask({
        image: cachedImageNode,
        method: `intensity`
      }).outputs.MASK;
      return cachedMask;
    };
    const resultImage = !form.image ? void 0 : createCachedImage(form.image, image);
    for (const k of form.imageVariables) {
      const variableImage = loadFromScope(state, k);
      if (!variableImage) {
        continue;
      }
      storeInScope(state, k, `image`, createCachedImage(k, variableImage) ?? variableImage);
    }
    const resultMask = !form.mask ? void 0 : createCachedMask(form.mask, mask);
    for (const k of form.maskVariables) {
      const variableMask = loadFromScope(state, k);
      if (!variableMask) {
        continue;
      }
      storeInScope(state, k, `mask`, createCachedMask(k, variableMask) ?? variableMask);
    }
    if (form.buildCache) {
      throw new PreviewStopError(() => {
      });
    }
    return { image: resultImage, mask: resultMask };
  }
});
var fileOperations = {
  saveImageFrame,
  loadImageFrame,
  cacheImageFrame
  // loadImageVariable,
  // storeImageVarible,
  // storeMaskVariable,
  // loadMaskVariable,
  // loadVariables,
  // storeVariables,
};
var fileOperationsList = createFrameOperationsGroupList(fileOperations);

// library/ricklove/my-cushy-deck/src/_operations/allOperations.ts
var divider = createFrameOperation({
  ui: (form) => ({}),
  run: ({ runtime, graph }, form, { image }) => {
    return {};
  }
});
var allOperationsList = createFrameOperationsChoiceList({
  ...imageOperations,
  ...maskOperations,
  ...resizingOperations,
  ...storageOperations,
  ...samplingOperations,
  ...fileOperations,
  [`---`]: divider
});
var allOperationsList_cached = createFrameOperationsChoiceList_cached({
  ...imageOperations,
  ...maskOperations,
  ...resizingOperations,
  ...storageOperations,
  ...samplingOperations,
  ...fileOperations,
  [`---`]: divider
});

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

// library/ricklove/my-cushy-deck/raw-power-02.ts
appOptimized({
  ui: (form) => ({
    cancel: form.inlineRun({
      kind: `warning`,
      text: `Cancel!`
    }),
    clearCache: form.inlineRun({
      kind: `warning`,
      text: `Clear Cache!!!`
    }),
    imageSource: form.group({
      items: () => ({
        directory: form.string({ default: `video` }),
        filePattern: form.string({ default: `#####.png` }),
        // pattern: form.string({ default: `*.png` }),
        startIndex: form.int({ default: 1, min: 0 }),
        endIndex: form.intOpt({ default: 1e4, min: 0, max: 1e4 }),
        selectEveryNth: form.intOpt({ default: 1, min: 1 }),
        // batchSize: form.int({ default: 1, min: 1 }),
        iterationCount: form.int({ default: 1, min: 1 }),
        // iterationSize: form.intOpt({ default: 1, min: 1 }),
        preview: form.inlineRun({})
      })
    }),
    // size: form.size({}),
    operations: allOperationsList_cached.ui(form)
  }),
  run: async (runtime, form) => {
    const jobStateStore = runtime.getStore_orCreateIfMissing(`jobState`, () => ({
      isCancelled: false
    }));
    const jobState = jobStateStore.get();
    if (form.cancel) {
      jobState.isCancelled = true;
      return;
    }
    const cacheStatusStore = runtime.getStore_orCreateIfMissing(`cacheStatus`, () => ({
      cache: []
    }));
    const cacheStatus = cacheStatusStore.get();
    console.log(`cacheStatus`, { cacheStatus: JSON.stringify(cacheStatus) });
    if (form.clearCache) {
      cacheStatus.cache = [];
      return;
    }
    const graph = runtime.nodes;
    const state = {
      runtime,
      graph,
      scopeStack: [{}],
      workingDirectory: `../input/working`,
      comfyUiInputRelativePath: `../comfyui/ComfyUI/input`,
      cacheState: {
        exists: (cacheStepIndex, dependencyKey, cacheFrameId) => {
          console.log(`cacheState: exists`, {
            cacheStepIndex,
            dependencyKey,
            cacheFrameId,
            cacheStatus: JSON.parse(JSON.stringify(cacheStatus))
          });
          const cacheResult = cacheStatus.cache.find(
            (x) => x.dependencyKey === dependencyKey && x.cacheFrameId === cacheFrameId
          );
          return cacheResult?.status === `cached`;
        },
        get: (cacheStepIndex, dependencyKey, cacheFrameId) => {
          console.log(`cacheState: get`, {
            cacheStepIndex,
            dependencyKey,
            cacheFrameId,
            cacheStatus: JSON.parse(JSON.stringify(cacheStatus))
          });
          const cacheResult = cacheStatus.cache.find(
            (x) => x.dependencyKey === dependencyKey && x.cacheFrameId === cacheFrameId
          );
          if (!cacheResult) {
            return void 0;
          }
          const getCachedObject = (sourceName, entries) => {
            return Object.fromEntries(
              entries.map((x) => {
                const cacheBuilerResult = x.kind === `mask` ? cacheMaskBuilder(
                  state,
                  `${cacheStepIndex.toString().padStart(4, `0`)}_${sourceName}_${x.key}`,
                  [],
                  {
                    dependencyKey
                  }
                ).loadCached() : cacheImageBuilder(
                  state,
                  `${cacheStepIndex.toString().padStart(4, `0`)}_${sourceName}_${x.key}`,
                  [],
                  {
                    dependencyKey
                  }
                ).loadCached();
                const nodeOutput = cacheBuilerResult.getOutput();
                cacheBuilerResult.modify(cacheFrameId);
                return [x.key, { value: nodeOutput, kind: x.kind }];
              })
            );
          };
          const frame01 = getCachedObject(`frame`, cacheResult.valueKeys.frame.entries);
          const frame = {
            image: frame01[`image`].value,
            mask: frame01[`mask`].value
          };
          const scopeStack = cacheResult.valueKeys.scopeStack.map(
            (s, i) => getCachedObject(`scopeStack${i.toString().padStart(2, `0`)}`, s.entries)
          );
          return { frame, scopeStack };
        },
        set: (cacheStepIndex, dependencyKey, cacheFrameId, data) => {
          console.log(`cacheState: set`, {
            cacheStepIndex,
            dependencyKey,
            cacheFrameId,
            data,
            cacheStatus: JSON.parse(JSON.stringify(cacheStatus))
          });
          const setCachedObject = (sourceName, data2) => {
            const result = Object.fromEntries(
              Object.entries(data2).map(([k, v]) => {
                if (!v) {
                  return [k, void 0];
                }
                const cacheBuilerResult = v.kind === `mask` ? cacheMaskBuilder(
                  state,
                  `${cacheStepIndex.toString().padStart(4, `0`)}_${sourceName}_${k}`,
                  [],
                  {
                    dependencyKey
                  }
                ).createCache(() => v.value) : cacheImageBuilder(
                  state,
                  `${cacheStepIndex.toString().padStart(4, `0`)}_${sourceName}_${k}`,
                  [],
                  {
                    dependencyKey
                  }
                ).createCache(() => v.value);
                if (!cacheBuilerResult) {
                  throw new Error(`cache failed to be created`);
                }
                const nodeOutput = cacheBuilerResult.getOutput();
                cacheBuilerResult.modify(cacheFrameId);
                return [k, nodeOutput];
              }).filter((k, v) => !!v)
            );
            return result;
          };
          const frame = setCachedObject(`frame`, {
            image: { value: data.frame.image, kind: `image` },
            mask: { value: data.frame.mask, kind: `mask` }
          });
          const scopeStack = data.scopeStack.map(
            (s, i) => setCachedObject(`scopeStack${i.toString().padStart(2, `0`)}`, s)
          );
          const valueKeys = {
            frame: {
              entries: [
                {
                  key: `image`,
                  kind: `image`
                },
                {
                  key: `mask`,
                  kind: `mask`
                }
              ]
            },
            scopeStack: data.scopeStack.map((s, i) => ({
              entries: Object.entries(s).filter(([k, v]) => !!v).map(([k, v]) => {
                return {
                  key: k,
                  kind: v.kind
                };
              })
            }))
          };
          const cacheValue = JSON.parse(
            JSON.stringify({
              cacheStepIndex,
              dependencyKey,
              cacheFrameId,
              status: `cached`,
              valueKeys
            })
          );
          const onCacheCreated = () => cacheStatus.cache.push(cacheValue);
          return { frame, scopeStack, onCacheCreated };
        }
      }
    };
    const runNext = () => {
      setTimeout(() => {
        if (jobState.isCancelled) {
          jobState.isCancelled = false;
          return;
        }
        runtime.st.currentDraft?.start();
      }, 10);
    };
    try {
      runtime.output_text({
        title: `START`,
        message: `START

${JSON.stringify(
          {
            cacheStatus
          },
          null,
          2
        )}`
      });
      const frameIds = [...new Array(form.imageSource.iterationCount)].map(
        (_, i) => form.imageSource.startIndex + i * (form.imageSource.selectEveryNth ?? 1)
      );
      const imageDir = form.imageSource.directory.replace(/\/$/g, ``);
      const loadImageNode = graph.RL$_LoadImageSequence({
        path: `${imageDir}/${form.imageSource.filePattern}`,
        current_frame: frameIds[0]
      });
      const initialImage = loadImageNode.outputs.image;
      const { INT: width, INT_1: height } = graph.Get_Image_Size({
        image: initialImage
      }).outputs;
      const initialMask = graph.SolidMask({
        width,
        height,
        value: 1
      });
      let cacheCount_stop = 0;
      while (true) {
        cacheCount_stop++;
        let wasCacheStopped = false;
        for (const frameId of frameIds) {
          loadImageNode.inputs.current_frame = frameId;
          if (form.imageSource.preview) {
            throw new PreviewStopError(() => {
            });
          }
          try {
            const frameIdProvider = createFrameIdProvider();
            allOperationsList_cached.run(state, form.operations, {
              image: initialImage,
              mask: initialMask,
              frameIdProvider,
              cacheStepIndex_current: 0,
              cacheStepIndex_stop: cacheCount_stop,
              cacheFrameId: frameId
            });
            continue;
          } catch (err) {
            if (!(err instanceof CacheStopError)) {
              throw err;
            }
            wasCacheStopped = true;
            if (err.wasAlreadyCached) {
              console.log(`CACHE wasAlreadyCached`, { frameId, cacheCount_stop });
              continue;
            }
            graph.PreviewImage({
              images: runtime.AUTO
            });
            await runtime.PROMPT();
            err.onCacheCreated();
            console.log(`CACHE created`, { frameId, cacheCount_stop });
            return runNext();
          }
        }
        if (!wasCacheStopped) {
          return;
        }
      }
    } catch (err) {
      if (!(err instanceof PreviewStopError)) {
        throw err;
      }
      const graph2 = state.graph;
      graph2.PreviewImage({
        images: runtime.AUTO
      });
      await runtime.PROMPT();
    } finally {
      runtime.output_text({
        title: `DONE`,
        message: `DONE

${JSON.stringify(
          {
            cacheStatus
          },
          null,
          2
        )}`
      });
    }
  }
});
