let utils = require("./SeedRandom");

console.log(utils.getRandomInt(Math.random(), 1, 13));
console.log(utils.getSeedRandom(Math.random()));
console.log(utils.getRandomArbitrary(Math.random(), 1, 13));
console.log(utils.getRandomIntInclusive(Math.random(), 1, 13));