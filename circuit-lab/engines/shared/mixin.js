// Adds method groups (plain objects, possibly with getters) to a class prototype.
// Lets a large class live in several focused modules while staying one class at runtime.
export function mixin(cls, ...groups) {
  for (const group of groups) Object.defineProperties(cls.prototype, Object.getOwnPropertyDescriptors(group));
  return cls;
}
