/**
 * Generates a random number with a normal distribution (Gaussian).
 * Uses the Box-Muller transform.
 *
 * @param {number} mean The mean (mu) of the distribution. Defaults to 0.
 * @param {number} stdDev The standard deviation (sigma) of the distribution. Defaults to 1.
 * @returns {number} A normally distributed random number.
 */
function getNormallyDistributedRandomNumber(mean = 0, stdDev = 1) {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random(); // Converting uniform [0,1) to (0,1)
  while (v === 0) v = Math.random();

  let z0 = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  // z1 (the second number generated) is Math.sqrt(-2.0 * Math.log(u)) * Math.sin(2.0 * Math.PI * v);
  // It is often discarded or stored for the next call to avoid generating two uniform random numbers per one normal number.

  return z0 * stdDev + mean;
}

/**
 * Generates an array of specified length filled with normally distributed random numbers.
 *
 * @param {number} size The length of the array to generate.
 * @param {number} mean The mean (mu) of the distribution. Defaults to 0.
 * @param {number} stdDev The standard deviation (sigma) of the distribution. Defaults to 1.
 * @returns {number[]} An array of normally distributed random numbers.
 */
export default function generateNormalArray(size, mean = 0, stdDev = 1) {
  const generatedNumbers = [];
  for (let i = 0; i < size; i++) {
    generatedNumbers.push(getNormallyDistributedRandomNumber(mean, stdDev));
  }
  return generatedNumbers;
}
