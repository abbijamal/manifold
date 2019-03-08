// @noflow
import * as tf from '@tensorflow/tfjs-core';
import {FEATURE_TYPE} from '../constants';

// dotRange(3) ==> [0, 1, 2];
export const dotRange = n => Array.from(Array(n).keys());

const UNIQ_COUNT_THRESHOLD = 8;
const UNIQ_PERCENTAGE_THRESHOLD = 0.1;
const INVALID_COUNT_THRESHOLD = 100;
const INVALID_PERCENTAGE_THRESHOLD = 0.5;

// identify whether a feature is categorical from its unique values
export const computeFeatureMeta = (
  data,
  resolution,
  uniqCountThreshold = UNIQ_COUNT_THRESHOLD,
  uniqPercentageThreshold = UNIQ_PERCENTAGE_THRESHOLD,
  invalidCountThreshold = INVALID_COUNT_THRESHOLD,
  invalidPercentageThreshold = INVALID_PERCENTAGE_THRESHOLD
) => {
  const uniques = Array.from(new Set(data));
  const hasNaN = uniques.some(isNaN);
  const isInvalid =
    hasNaN &&
    uniques.length > data.length * invalidPercentageThreshold &&
    uniques.length > invalidCountThreshold;

  if (isInvalid) {
    return {
      type: null,
      domain: null,
    };
  }

  const isCategorical =
    (uniques.length < uniqCountThreshold &&
      uniques.length < data.length * uniqPercentageThreshold) ||
    hasNaN;

  const domain = isCategorical
    ? uniques
    : computeNumericFeatureDomain(uniques, resolution);

  return {
    type: isCategorical ? FEATURE_TYPE.CATEGORICAL : FEATURE_TYPE.NUMERICAL,
    domain,
  };
};

const FEATURE_HISTOGRAM_RESOLUTION = 100;

export const computeNumericFeatureDomain = (
  values,
  resolution = FEATURE_HISTOGRAM_RESOLUTION
) => {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const step = (max - min) / resolution;
  return dotRange(resolution + 1).map(d => min + d * step);
};

/**
 * @param {Array} data - 1-D array of data points
 * @param {Array} bins - (optional) categories
 * @returns [{Array}] an array of 2 arrays:
 * 0: hist, values of the histogram; 1: categories, length = hist.length.
 */
export function computeHistogramCat(data, bins) {
  // parse the overloaded bins argument
  let categories;

  if (bins === undefined) {
    categories = Array.from(new Set(data));
  } else if (Array.isArray(bins) && bins.length) {
    categories = bins;
  } else {
    throw '`bins` must be an non-empty array';
  }

  const nBins = categories.length;
  const indices = tf.tensor1d(data.map(d => categories.indexOf(d))).toInt();
  const binIds = tf.linspace(0, nBins - 1, nBins).toInt();

  const hist = binCount(indices, binIds);
  return [Array.from(hist.dataSync()), categories];
}

/**
 * @param {Array} data - 1-D array of data points
 * @param {Number|Array} bins - number of bins, or bin edges
 * @return [{Array}] an array of 2 arrays:
 * 0: hist, values of the histogram;
 * 1: binEdges, an array of edge values (X values) of bins, length = hist.length + 1.
 */
export function computeHistogram(data, bins) {
  return tf.tidy(() => {
    const dt = tf.tensor(data);
    if (dt.dtype === 'string') {
      return computeHistogramCat(data, bins);
    }
    const minEdge = tf.min(dt).dataSync()[0];
    const maxEdge = tf.max(dt).dataSync()[0];

    // parse the overloaded bins argument
    let nBins, binEdges;

    if (Number.isInteger(bins)) {
      nBins = bins;
      binEdges = tf.linspace(minEdge, maxEdge, nBins + 1);
    } else if (bins.length) {
      nBins = bins.length - 1;
      binEdges = tf.tensor1d(bins);
    } else {
      throw '`bins` must be a number or an array';
    }

    // histogram scaling factor
    const norm = nBins / (maxEdge - minEdge);

    const indicesRaw = tf
      .mul(tf.sub(dt, tf.scalar(minEdge)), tf.scalar(norm))
      .toInt();

    // for values that lie exactly on maxEdge we need to subtract one
    const indices = tf.sub(
      indicesRaw,
      tf.equal(indicesRaw, tf.scalar(nBins).toInt()).toInt()
    );

    const binIds = tf.linspace(0, nBins - 1, nBins).toInt();
    const hist = binCount(indices, binIds);

    return [Array.from(hist.dataSync()), Array.from(binEdges.dataSync())];
  });
}

/**
 * @param {Array} data - 1-D array, each element is a bin id
 * @param {Number} bins - 1-D array representing bin indices
 * @return {Tensor1D} number of occurrences of bin indices, ordered by bin index
 */
export function binCount(data, bins) {
  return tf.tidy(() => {
    return tf.sum(
      tf.equal(
        // perform outer operations by expanding dimensions
        tf.expandDims(data, 1),
        bins
      ),
      0
    );
  });
}