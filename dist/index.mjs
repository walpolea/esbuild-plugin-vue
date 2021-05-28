// src/index.ts
import fs from "fs";
import path from "path";
import {
  compileScript,
  compileStyleAsync,
  compileTemplate,
  parse
} from "@vue/compiler-sfc";
import hash from "hash-sum";
var removeQuery = (p) => p.replace(/\?.+$/, "");
var genId = (filepath) => hash(path.relative(process.cwd(), filepath));
var src_default = () => {
  return {
    name: "vue",
    setup(build) {
      const absPath = path.resolve(process.cwd(), build.initialOptions.absWorkingDir || "");
      const formatPath = (p, resolveDir) => {
        if (p.startsWith(".")) {
          return path.resolve(resolveDir, p);
        }
        if (p.startsWith(absPath + "/")) {
          return p;
        }
        return path.join(absPath, p);
      };
      build.onResolve({filter: /\.vue$/}, (args) => {
        return {
          path: formatPath(args.path, args.resolveDir),
          namespace: "vue"
        };
      });
      build.onResolve({filter: /\?vue&type=template/}, (args) => {
        return {path: args.path, namespace: "vue"};
      });
      build.onResolve({filter: /\?vue&type=script/}, (args) => {
        return {path: args.path, namespace: "vue"};
      });
      build.onResolve({filter: /\?vue&type=style/}, (args) => {
        return {path: args.path, namespace: "vue"};
      });
      build.onLoad({filter: /\.vue$/, namespace: "vue"}, async (args) => {
        const content = await fs.promises.readFile(args.path, "utf8");
        const sfc = parse(content);
        const filepath = args.path.replace(/\\/g, "/");
        let contents = ``;
        if (sfc.descriptor.script) {
          contents += `
          import $$Component from "${filepath}?vue&type=script"
          `;
        } else {
          contents += `var $$Component = {}`;
        }
        if (sfc.descriptor.styles.length > 0) {
          contents += `
          import "${filepath}?vue&type=style"
          `;
        }
        if (sfc.descriptor.template) {
          contents += `
          import { render } from "${filepath}?vue&type=template"
          export * from "${filepath}?vue&type=template"
          $$Component.render = render
          `;
        }
        contents += `export default $$Component`;
        return {
          contents,
          resolveDir: path.dirname(args.path)
        };
      });
      build.onLoad({filter: /\?vue&type=template/, namespace: "vue"}, async (args) => {
        const filepath = removeQuery(args.path);
        const source = await fs.promises.readFile(filepath, "utf8");
        const {descriptor} = parse(source);
        if (descriptor.template) {
          const hasScoped = descriptor.styles.some((s) => s.scoped);
          const id = genId(filepath);
          const compiled = compileTemplate({
            source: descriptor.template.content,
            filename: filepath,
            id,
            scoped: hasScoped,
            compilerOptions: {
              scopeId: hasScoped ? `data-v-${id}` : void 0
            }
          });
          return {
            resolveDir: path.dirname(filepath),
            contents: compiled.code
          };
        }
      });
      build.onLoad({filter: /\?vue&type=script/, namespace: "vue"}, async (args) => {
        const filepath = removeQuery(args.path);
        const source = await fs.promises.readFile(filepath, "utf8");
        const {descriptor} = parse(source, {filename: filepath});
        if (descriptor.script) {
          const compiled = compileScript(descriptor, {
            id: genId(filepath)
          });
          return {
            resolveDir: path.dirname(filepath),
            contents: compiled.content,
            loader: compiled.lang === "ts" ? "ts" : "js"
          };
        }
      });
      build.onLoad({filter: /\?vue&type=style/, namespace: "vue"}, async (args) => {
        const filepath = removeQuery(args.path);
        const source = await fs.promises.readFile(filepath, "utf8");
        const {descriptor} = parse(source);
        if (descriptor.styles.length > 0) {
          const id = genId(filepath);
          let content = "";
          for (const style of descriptor.styles) {
            const compiled = await compileStyleAsync({
              source: style.content,
              filename: filepath,
              id,
              scoped: style.scoped,
              preprocessLang: style.lang,
              modules: !!style.module
            });
            if (compiled.errors.length > 0) {
              throw compiled.errors[0];
            }
            content += compiled.code;
          }
          return {
            resolveDir: path.dirname(filepath),
            contents: content,
            loader: "css"
          };
        }
      });
    }
  };
};
export {
  src_default as default
};
