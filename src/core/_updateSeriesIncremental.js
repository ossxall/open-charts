// Incremental series update — O(period) per series, not O(n).
// Falls back to full compute() if the series has no updateIncremental hook.
export function _updateSeriesIncremental(isNewBar) {
  this._series.forEach((entry) => {
    if (entry.def.updateIncremental) {
      entry.def.updateIncremental(
        this.data,
        entry.values,
        isNewBar,
        entry.params,
      );
    } else {
      entry.values = entry.def.compute(this.data, entry.params);
    }
  });
}
