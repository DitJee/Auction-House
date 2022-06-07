const path = require("path");
const programDir = path.join(__dirname, "..", "programs/auction-house");
const idlDir = path.join(__dirname, "idl");
const sdkDir = path.join(__dirname, "src", "generated");
const binaryInstallDir = path.join(__dirname, ".crates");

module.exports = {
  idlGenerator: "anchor",
  programName: "auction_house",
  programId: "Er4qqGJpN9CkQWeUp1P87aWYzkCqd4NbbKi8vtoNfPUJ",
  idlDir,
  sdkDir,
  binaryInstallDir,
  programDir,
};
