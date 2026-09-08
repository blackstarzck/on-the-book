import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
export async function startServer(port, password) {
  const dir = await mkdtemp(path.join(tmpdir(), "on-the-book-test-"));
  const child = spawn(process.execPath, ["server/index.js", "--production"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATA_DIR: dir,
      PORT: String(port),
      ADMIN_PASSWORD: password || "",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let logs = "";
  child.stdout.on("data", (d) => (logs += d));
  child.stderr.on("data", (d) => (logs += d));
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(url + "/api/library");
      if (res.ok)
        return {
          url,
          dir,
          child,
          async stop() {
            child.kill();
            await new Promise((resolve) =>
              child.exitCode !== null ? resolve() : child.once("exit", resolve),
            );
            if (
              path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) ||
              !path.basename(dir).startsWith("on-the-book-test-")
            )
              throw Error("Unsafe test cleanup path");
            await rm(dir, { recursive: true, force: true });
          },
        };
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw Error(logs || "Test server did not start");
}
export function sampleGLB(rigged = true) {
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
