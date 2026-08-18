import type {
  Binding,
  BindingEvaluation,
  Condition,
  DeviceProfile,
  PrimitiveValue,
  RuntimeContext,
  RuntimeEvaluation,
  Scene,
  Widget,
} from "../Domain/models";

function getDefinition(profile: DeviceProfile, condition: Condition) {
  const source = condition.source ?? "state";
  const definitions = source === "setting" ? profile.runtimeSettings : profile.runtimeStates;
  return definitions.find((definition) => definition.id === condition.stateId);
}

function isNumber(value: PrimitiveValue | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function valuesEqual(left: PrimitiveValue | null | undefined, right: PrimitiveValue): boolean {
  return left === right;
}

export function conditionMatches(
  condition: Condition,
  context: RuntimeContext,
  profile: DeviceProfile,
): boolean {
  const definition = getDefinition(profile, condition);
  if (!definition) return false;

  const source = condition.source ?? "state";
  const value = (source === "setting" ? context.settings : context.values)?.[condition.stateId];
  if (value === undefined || value === null) return false;
  let matched = false;

  switch (condition.operator) {
    case "equals":
      matched = valuesEqual(value, condition.value);
      break;
    case "not-equals":
      matched = !valuesEqual(value, condition.value);
      break;
    case "greater-than":
      matched = isNumber(value) && isNumber(condition.value) && value > condition.value;
      break;
    case "less-than":
      matched = isNumber(value) && isNumber(condition.value) && value < condition.value;
      break;
    case "contains":
      matched = typeof value === "string" && typeof condition.value === "string" && value.includes(condition.value);
      break;
  }

  return condition.negated ? !matched : matched;
}

export function conditionsMatch(
  conditions: readonly Condition[],
  mode: "all" | "any" = "all",
  context: RuntimeContext,
  profile: DeviceProfile,
): boolean {
  if (conditions.length === 0) return true;
  return mode === "any"
    ? conditions.some((condition) => conditionMatches(condition, context, profile))
    : conditions.every((condition) => conditionMatches(condition, context, profile));
}

export function selectActiveScene(
  scenes: readonly Scene[],
  context: RuntimeContext,
  profile: DeviceProfile,
): RuntimeEvaluation {
  const candidates = scenes.map((scene, index) => ({
    sceneId: scene.id,
    priority: scene.priority,
    activationOrder: context.sceneActivationOrder?.[scene.id] ?? index,
    matched:
      scene.enabled !== false &&
      conditionsMatch(scene.activationConditions, scene.activationConditionMode, context, profile),
  }));

  const activeCandidate = candidates
    .filter((candidate) => candidate.matched)
    .sort((left, right) =>
      right.priority - left.priority || right.activationOrder - left.activationOrder,
    )[0];

  return {
    activeSceneId: activeCandidate?.sceneId,
    activeScene: scenes.find((scene) => scene.id === activeCandidate?.sceneId),
    candidates,
  };
}

export function evaluateBinding(
  binding: Binding,
  context: RuntimeContext,
  profile: DeviceProfile,
): BindingEvaluation {
  return {
    bindingId: binding.id,
    widgetId: binding.widgetId,
    matched: conditionsMatch(binding.conditions, binding.conditionMode, context, profile),
    action: binding.action,
    contentId: binding.contentId,
  };
}

export function evaluateActiveSceneBindings(
  scene: Scene | undefined,
  context: RuntimeContext,
  profile: DeviceProfile,
): readonly BindingEvaluation[] {
  if (!scene) return [];
  return scene.widgets.flatMap((widget: Widget) =>
    widget.bindings.map((binding) => evaluateBinding(binding, context, profile)),
  );
}
