import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
// A test server is usually up within a second or two. A busy machine (other sessions building and testing at the
// same time) has needed more than the old 8 seconds, and a server that dies is reported at once, so the wait is long.
const startTimeout = 60_000;
// Starts the production server on a throwaway data folder and on a port the system picks (PORT=0), then waits until
// it answers. The server reports the port it bound over an IPC channel (server/index.js), so a test only ever talks
// to its own server, and runs in other sessions, worktrees or test files never share one.
// `password` turns on the studio login; `prepare(dir)` may fill the data folder before the server reads it.
// Older callers passed a fixed port first, startServer(4336, password, prepare); that form still works and the port
// is ignored.
export async function startServer(options = {}, legacyPassword, legacyPrepare) {
  const { password = "", prepare } =
    typeof options === "number" ? { password: legacyPassword, prepare: legacyPrepare } : options;
  const dir = await mkdtemp(path.join(tmpdir(), "on-the-book-test-"));
  let child;
  let logs = "";
  const running = () => child && child.exitCode === null && child.signalCode === null;
  const failure = (reason) => Error(`${logs}\nTest server ${reason}`.trim());
  async function stop() {
    if (running()) {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      child.kill();
      await exited;
    }
    if (
      path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) ||
      !path.basename(dir).startsWith("on-the-book-test-")
    )
      throw Error("Unsafe test cleanup path");
    await rm(dir, { recursive: true, force: true });
  }
  try {
    await prepare?.(dir);
    // Test servers keep their data in the temporary folder and must never reach the shared Supabase project.
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("SUPABASE_")));
    child = spawn(process.execPath, ["server/index.js", "--production"], {
      cwd: process.cwd(),
      env: { ...env, DATA_DIR: dir, PORT: "0", ADMIN_PASSWORD: password || "" },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      windowsHide: true,
    });
    child.stdout.on("data", (d) => (logs += d));
    child.stderr.on("data", (d) => (logs += d));
    const deadline = Date.now() + startTimeout;
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(failure(`did not start within ${startTimeout / 1000} seconds`)), startTimeout);
      const fail = (reason) => {
        clearTimeout(timer);
        reject(failure(reason));
      };
      child.on("message", (message) => {
        if (!Number.isInteger(message?.listening)) return;
        clearTimeout(timer);
        resolve(message.listening);
      });
      child.on("error", (error) => fail(`could not start: ${error.message}`));
      child.once("close", (code, signal) => fail(`stopped (${signal || code}) before it listened`));
    });
    const url = `http://127.0.0.1:${port}`;
    // It is listening now; on a busy machine the first answer can still take a moment.
    for (;;) {
      if (!running()) throw failure("stopped before it answered");
      try {
        const res = await fetch(url + "/api/library");
        await res.arrayBuffer();
        if (res.ok) return { url, dir, child, stop };
      } catch {}
      if (Date.now() > deadline) throw failure(`did not answer within ${startTimeout / 1000} seconds`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (error) {
    await stop();
    throw error;
  }
}
// rigged adds a skin that the Float clip moves; animated false leaves a still model with no clips.
export function sampleGLB(rigged = true, animated = true) {
  const floats = new Float32Array([
    -1, 0, 0, 1, 0, 0, 0, 2, 0, 0, 1, 0, 0, 0, 0, 1, 0,
  ]);
  let bin = Buffer.from(floats.buffer);
  const json = {
    asset: { version: "2.0", generator: "On the Book test fixture" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
    materials: [
      {
        doubleSided: true,
        pbrMetallicRoughness: { baseColorFactor: [0.4, 0.65, 0.5, 1] },
      },
    ],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36, target: 34962 },
      { buffer: 0, byteOffset: 36, byteLength: 8 },
      { buffer: 0, byteOffset: 44, byteLength: 24 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 3,
        type: "VEC3",
        min: [-1, 0, 0],
        max: [1, 2, 0],
      },
      {
        bufferView: 1,
        componentType: 5126,
        count: 2,
        type: "SCALAR",
        min: [0],
        max: [1],
      },
      { bufferView: 2, componentType: 5126, count: 2, type: "VEC3" },
    ],
    animations: [
      {
        name: "Float",
        channels: [{ sampler: 0, target: { node: 0, path: "translation" } }],
        samplers: [{ input: 1, output: 2, interpolation: "LINEAR" }],
      },
    ],
  };
  if(rigged){
    const jointOffset=bin.length,weightOffset=jointOffset+12;
    bin=Buffer.concat([bin,Buffer.alloc(12),Buffer.from(new Float32Array([1,0,0,0,1,0,0,0,1,0,0,0]).buffer)]);
    json.nodes[0].skin=0;json.nodes.push({name:'RootJoint'});json.scenes[0].nodes.push(1);json.skins=[{joints:[1]}];
    json.bufferViews.push({buffer:0,byteOffset:jointOffset,byteLength:12},{buffer:0,byteOffset:weightOffset,byteLength:48});
    json.accessors.push({bufferView:3,componentType:5121,count:3,type:'VEC4'},{bufferView:4,componentType:5126,count:3,type:'VEC4'});
    json.meshes[0].primitives[0].attributes.JOINTS_0=3;json.meshes[0].primitives[0].attributes.WEIGHTS_0=4;
    json.animations[0].channels[0].target.node=1;json.buffers[0].byteLength=bin.length;
  }
  if (!animated) delete json.animations;
  let text = Buffer.from(JSON.stringify(json));
  const padding = (4 - (text.length % 4)) % 4;
  text = Buffer.concat([text, Buffer.alloc(padding, 32)]);
  const header = Buffer.alloc(20);
  header.write("glTF");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + text.length + 8 + bin.length, 8);
  header.writeUInt32LE(text.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(bin.length);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, text, bh, bin]);
}
