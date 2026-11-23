import { writeFile, mkdir } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { structure } from '../src/models/architecture.js';
import { group,optimize } from '../src/models/kit.js';

globalThis.FileReader = class {
  async readAsArrayBuffer(blob) {
    this.result=await blob.arrayBuffer();
    this.onloadend();
  }
};
const root = new URL('../src/assets/',import.meta.url);
await mkdir(root,{recursive:true});
for(const [id,filename] of [['church','igreja'],['chapel','capela']]){
  const model=group(null,id);
  structure(model,id);
  const glb=await new GLTFExporter().parseAsync(optimize(model),{binary:true});
  await writeFile(new URL(filename+'.glb',root),Buffer.from(glb));
}

