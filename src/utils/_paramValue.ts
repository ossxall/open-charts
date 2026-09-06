/**
 * A parameter is stored either as a plain value or as a descriptor
 * object (`{ value, affectsCompute?, options?, min?, max?, step? }`).
 *
 * Descriptors are used by series whose parameters affect computation
 * or expose extra UI hints (options, ranges) inside the settings modal.
 */
export interface ParamDescriptor {
  value: unknown;
  affectsCompute?: boolean;
  options?: readonly unknown[] | readonly { label: string; value: unknown }[];
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Determines whether a stored parameter is a descriptor object.
 *
 * Plain values (primitives, arrays) are returned as-is; descriptors are
 * objects that carry a `value` property.
 */
export function _isParamDescriptor(value: unknown): value is ParamDescriptor {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "value" in value
  );
}

/**
 * Resolves the effective value of a stored parameter.
 *
 * For descriptor objects the inner `value` is returned; for plain
 * values the value itself is returned unchanged.
 */
export function _resolveParamValue(field: unknown): unknown {
  return _isParamDescriptor(field) ? (field as ParamDescriptor).value : field;
}
