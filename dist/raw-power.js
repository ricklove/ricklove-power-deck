// ▄████████ ███    █▄     ▄████████    ▄█    █▄    ▄██   ▄           ▄████████    ▄███████▄    ▄███████▄
// ███    ███ ███    ███   ███    ███   ███    ███   ███   ██▄        ███    ███   ███    ███   ███    ███
// ███    █▀  ███    ███   ███    █▀    ███    ███   ███▄▄▄███        ███    ███   ███    ███   ███    ███
// ███        ███    ███   ███         ▄███▄▄▄▄███▄▄ ▀▀▀▀▀▀███        ███    ███   ███    ███   ███    ███
// ███        ███    ███ ▀███████████ ▀▀███▀▀▀▀███▀  ▄██   ███      ▀███████████ ▀█████████▀  ▀█████████▀
// ███    █▄  ███    ███          ███   ███    ███   ███   ███        ███    ███   ███          ███
// ███    ███ ███    ███    ▄█    ███   ███    ███   ███   ███        ███    ███   ███          ███
// ████████▀  ████████▀   ▄████████▀    ███    █▀     ▀█████▀         ███    █▀   ▄████▀       ▄████▀

// library/ricklove/my-cushy-deck/src/_appState.ts
var StopError = class extends Error {
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
var cacheImageBuilder = (state, folderPrefix, params, dependencyKeyRef) => {
  const { runtime, graph } = state;
  const paramsHash = `` + createRandomGenerator(`${JSON.stringify(params)}:${dependencyKeyRef.dependencyKey}`).randomInt();
  dependencyKeyRef.dependencyKey = paramsHash;
  const paramsFolderPattern = `${state.workingDirectory}/${folderPrefix}-${paramsHash}`;
  const location = `input`;
  const paramsFilePattern = `../${location}/${paramsFolderPattern}/#####.png`;
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
var cacheImage = async (state, folderPrefix, frameIndex, params, dependencyKeyRef, createGraph) => {
  const { runtime, graph } = state;
  const paramsHash = `` + createRandomGenerator(`${JSON.stringify(params)}:${dependencyKeyRef.dependencyKey}`).randomInt();
  dependencyKeyRef.dependencyKey = paramsHash;
  const paramsFilePattern = `${state.workingDirectory}/${folderPrefix}-${paramsHash}/#####.png`;
  const loadImage_graph = () => {
    const imageReloaded = graph.RL$_LoadImageSequence({
      path: paramsFilePattern,
      current_frame: frameIndex
    }).outputs.image;
    return imageReloaded;
  };
  const createImage_execute = async () => {
    const image = await createGraph();
    if (!image) {
      return void 0;
    }
    graph.RL$_SaveImageSequence({
      images: image,
      current_frame: frameIndex,
      path: paramsFilePattern
    });
    const result = await runtime.PROMPT();
    if (result.data.error) {
      throw new Error(`cacheImage: Failed to create image`);
    }
  };
  const iNextInitial = getNextActiveNodeIndex(runtime);
  const loadingMessage = showLoadingMessage(runtime, `cacheImage( ${frameIndex} )`, { frameIndex, params });
  try {
    const image = loadImage_graph();
    const result = await runtime.PROMPT();
    if (result.data.error) {
      result.delete();
      throw new Error(`ignore`);
    }
    loadingMessage.delete();
    console.log(
      `cacheImage: Load Success`,
      JSON.parse(
        JSON.stringify({
          data: result.data,
          finished: result.finished
        })
      )
    );
    return { image };
  } catch {
    disableNodesAfterInclusive(runtime, iNextInitial);
  }
  console.log(`cacheImage: Failed to load - creating`, {
    paramsFilePattern,
    frameIndex,
    params
  });
  await createImage_execute();
  disableNodesAfterInclusive(runtime, iNextInitial);
  loadingMessage.delete();
  return { image: loadImage_graph() };
};
var cacheMask = async (state, folderPrefix, frameIndex, params, dependencyKeyRef, createGraph) => {
  const { graph } = state;
  const { image: reloadedMaskImage } = await cacheImage(state, folderPrefix, frameIndex, params, dependencyKeyRef, async () => {
    const mask = await createGraph();
    if (!mask) {
      return void 0;
    }
    const maskImage = graph.MaskToImage({ mask });
    return maskImage;
  });
  if (!reloadedMaskImage) {
    return { mask: void 0 };
  }
  const maskReloaded = graph.Image_To_Mask({
    image: reloadedMaskImage,
    method: `intensity`
  }).outputs.MASK;
  return { mask: maskReloaded };
};

// library/ricklove/my-cushy-deck/src/_maskPrefabs.ts
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
        threshold: form.float({ default: 0.4, min: 0, max: 1, step: 0.01 })
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
  run: (state, image, mask, form) => {
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
          throw new StopError(void 0);
        }
        const maskAsImage = graph.MaskToImage({ mask });
        const maskPreview = graph.ImageBlend({
          image1: maskAsImage,
          image2: image,
          blend_mode: `normal`,
          blend_factor: 0.5
        });
        graph.PreviewImage({ images: maskPreview });
        throw new StopError(void 0);
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
            throw new StopError(void 0);
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
          throw new StopError(void 0);
        }
      }
    } catch (err) {
      if (!(err instanceof StopError)) {
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
    }
  };
  return {
    state: _state,
    defineStep,
    runSteps
  };
};

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
    previewCropMask: form.inlineRun({}),
    previewCrop: form.inlineRun({}),
    _2: form.markdown({
      markdown: () => `# Mask Replacement`
    }),
    //operation_mask.ui(form).maskOperations,
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
        // sideFrameDoubleBack: form.bool({}),
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
    const _imageDirectory = form.imageSource.directory.replace(/\/$/g, ``);
    const {
      defineStep,
      runSteps,
      state: _state
    } = createStepsSystem({
      runtime,
      imageDirectory: form.imageSource.directory.replace(/\/$/g, ``),
      graph: runtime.nodes,
      scopeStack: [{}]
    });
    const startImageStep = defineStep({
      name: `startImageStep`,
      preview: form.imageSource.preview,
      cacheParams: [],
      inputSteps: {},
      create: ({ graph, imageDirectory }) => {
        const loadImageNode = graph.RL$_LoadImageSequence({
          path: `${imageDirectory}/${form.imageSource.filePattern}`,
          current_frame: 0
        });
        const startImage = loadImageNode.outputs.image;
        return {
          nodes: { loadImageNode },
          outputs: { startImage }
        };
      },
      modify: ({ nodes, frameIndex }) => {
        nodes.loadImageNode.inputs.current_frame = frameIndex;
      }
    });
    const cropMaskStep = defineStep({
      name: `cropMaskStep`,
      preview: form.previewCropMask,
      cacheParams: [form.cropMaskOperations],
      inputSteps: { startImageStep },
      create: (state, { inputs }) => {
        const { startImage } = inputs;
        const cropMask = operation_mask.run(state, startImage, void 0, form.cropMaskOperations);
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
      cacheParams: [form.size, form.cropPadding],
      inputSteps: { startImageStep, cropMaskStep },
      create: ({ graph }, { inputs }) => {
        const { startImage, cropMask } = inputs;
        const { size: sizeInput, cropPadding } = form;
        const size = typeof sizeInput === `number` ? sizeInput : Number(sizeInput.id);
        const croppedImage = !cropMask ? startImage : graph.RL$_Crop$_Resize({
          image: startImage,
          mask: cropMask,
          max_side_length: size,
          padding: cropPadding
        }).outputs.cropped_image;
        return {
          nodes: {},
          outputs: { croppedImage }
        };
      },
      modify: ({ nodes, frameIndex }) => {
      }
    });
    const replaceMaskStep = defineStep({
      name: `replaceMaskStep`,
      preview: form.previewReplaceMask,
      cacheParams: [form.replaceMaskOperations],
      inputSteps: { cropStep },
      create: (state, { inputs }) => {
        const { croppedImage } = inputs;
        const replaceMask = operation_mask.run(state, croppedImage, void 0, form.replaceMaskOperations);
        return {
          nodes: {},
          outputs: { replaceMask }
        };
      },
      modify: ({ nodes, frameIndex }) => {
      }
    });
    const controlNetStackStep = (() => {
      let controlNetStepPrev = void 0;
      for (const c of form.controlNet) {
        const preprocessorKind = c.controlNet.toLowerCase().includes(`depth`) ? `zoe-depth` : c.controlNet.toLowerCase().includes(`normal`) ? `bae-normal` : void 0;
        const preprocessorStep = defineStep({
          name: `preprocessorStep`,
          preview: c.preview,
          cacheParams: [preprocessorKind],
          inputSteps: { cropStep },
          create: ({ graph }, { inputs }) => {
            const { croppedImage } = inputs;
            const imagePre = preprocessorKind === `zoe-depth` ? graph.Zoe$7DepthMapPreprocessor({ image: croppedImage }).outputs.IMAGE : preprocessorKind === `bae-normal` ? graph.BAE$7NormalMapPreprocessor({ image: croppedImage }).outputs.IMAGE : croppedImage;
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
          throw new StopError(void 0);
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
          throw new StopError(void 0);
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
    if (form.film?.singleFramePyramidSize) {
      const { singleFramePyramidSize } = form.film;
      const filmStep = defineStep({
        name: `filmStep`,
        preview: form.film.preview,
        cacheParams: [singleFramePyramidSize],
        inputSteps: { samplerSteps },
        create: (state, { inputs }) => {
          const finalImages = samplerSteps.map((x) => x._build?.outputs.finalImage).filter((x) => x).map((x) => x);
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
            oddFrames = graph.ImageBatchFork({
              images: filmFrames,
              priority: `first`
            }).outputs.IMAGE_1;
          }
          const interpolatedFrame = oddFrames;
          return {
            nodes: {},
            outputs: { interpolatedFrame }
          };
        },
        modify: ({ nodes, frameIndex }) => {
        }
      });
    }
    const frameIndexes = [...new Array(form.imageSource.iterationCount)].map((_, i) => ({
      frameIndex: form.imageSource.startIndex + i * (form.imageSource.selectEveryNth ?? 1)
    }));
    await runSteps(frameIndexes.map((x) => x.frameIndex));
    return;
    const iterate = async (iterationIndex) => {
      runtime.print(`${JSON.stringify(form)}`);
      const dependencyKeyRef = { dependencyKey: `` };
      const state = _state;
      const { imageDirectory, graph } = state;
      state.scopeStack = [{}];
      const frameIndex = form.imageSource.startIndex + iterationIndex * (form.imageSource.selectEveryNth ?? 1);
      const startImage = graph.RL$_LoadImageSequence({
        path: `${imageDirectory}/${form.imageSource.filePattern}`,
        current_frame: frameIndex
      }).outputs.image;
      if (form.imageSource.preview) {
        graph.PreviewImage({ images: startImage });
        throw new StopError(void 0);
      }
      const { mask: cropMask } = await cacheMask(
        state,
        `cropMask`,
        frameIndex,
        form.cropMaskOperations,
        dependencyKeyRef,
        async () => operation_mask.run(state, startImage, void 0, form.cropMaskOperations)
      );
      if (form.previewCropMask) {
        graph.PreviewImage({ images: startImage });
        if (cropMask) {
          const maskImage = graph.MaskToImage({ mask: cropMask });
          graph.PreviewImage({ images: maskImage });
        }
        throw new StopError(void 0);
      }
      const { size: sizeInput, cropPadding } = form;
      const size = typeof sizeInput === `number` ? sizeInput : Number(sizeInput.id);
      const { image: croppedImage } = !cropMask ? { image: startImage } : await cacheImage(
        state,
        `croppedImage`,
        frameIndex,
        { size, cropPadding },
        dependencyKeyRef,
        async () => graph.RL$_Crop$_Resize({
          image: startImage,
          mask: cropMask,
          max_side_length: size,
          padding: cropPadding
        }).outputs.cropped_image
      );
      if (form.previewCrop) {
        graph.PreviewImage({ images: startImage });
        if (cropMask) {
          const maskImage = graph.MaskToImage({ mask: cropMask });
          graph.PreviewImage({ images: maskImage });
        }
        graph.PreviewImage({ images: croppedImage });
        throw new StopError(void 0);
      }
      const { mask: replaceMask } = await cacheMask(
        state,
        `replaceMask`,
        frameIndex,
        form.replaceMaskOperations,
        dependencyKeyRef,
        async () => await operation_mask.run(state, croppedImage, void 0, form.replaceMaskOperations)
      );
      let controlNetStack = void 0;
      for (const c of form.controlNet) {
        const preprocessorKind = c.controlNet.toLowerCase().includes(`depth`) ? `zoe-depth` : c.controlNet.toLowerCase().includes(`normal`) ? `bae-normal` : void 0;
        const { image: imagePre } = !preprocessorKind ? { image: croppedImage } : await cacheImage(
          state,
          `preprocessor`,
          frameIndex,
          { preprocessorKind },
          dependencyKeyRef,
          async () => preprocessorKind === `zoe-depth` ? graph.Zoe$7DepthMapPreprocessor({ image: croppedImage }) : preprocessorKind === `bae-normal` ? graph.BAE$7NormalMapPreprocessor({ image: croppedImage }) : croppedImage
        );
        if (c.preview) {
          graph.PreviewImage({ images: imagePre });
          throw new StopError(void 0);
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
        throw new StopError(void 0);
      }
      const seed = form.sampler.seed;
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
      const sampler = graph.KSampler_Adv$5_$1Efficient$2({
        add_noise: form.sampler.add_noise ? `enable` : `disable`,
        return_with_leftover_noise: `disable`,
        vae_decode: `true`,
        preview_method: `auto`,
        noise_seed: seed,
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
      graph.SaveImage({
        images: graph.VAEDecode({ samples: sampler, vae: loader }),
        filename_prefix: "ComfyUI"
      });
      const result = await runtime.PROMPT();
    };
    for (let i = 0; i < form.imageSource.iterationCount; i++) {
      const loadingMain = showLoadingMessage(runtime, `iteration: ${i}`);
      try {
        await iterate(i);
        loadingMain.delete();
        disableNodesAfterInclusive(runtime, 0);
      } catch (err) {
        if (!(err instanceof StopError)) {
          throw err;
        }
        await runtime.PROMPT();
        loadingMain.delete();
      }
    }
  }
});
