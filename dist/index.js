"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }// src/index.ts
var _fs = require('fs'); var _fs2 = _interopRequireDefault(_fs);
var _path = require('path'); var _path2 = _interopRequireDefault(_path);





var _compilersfc = require('@vue/compiler-sfc');
var _hashsum = require('hash-sum'); var _hashsum2 = _interopRequireDefault(_hashsum);
var removeQuery = (p) => p.replace(/\?.+$/, "");
var genId = (filepath) => _hashsum2.default.call(void 0, _path2.default.relative(process.cwd(), filepath));
var src_default = () => {
  return {
    name: "vue",
    setup(build) {
      const absPath = _path2.default.resolve(process.cwd(), build.initialOptions.absWorkingDir || "");
      const formatPath = (p, resolveDir) => {
        if (p.startsWith(".")) {
          return _path2.default.resolve(resolveDir, p);
        }
        if (p.startsWith(absPath + "/")) {
          return p;
        }
        return _path2.default.join(absPath, p);
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
        const content = await _fs2.default.promises.readFile(args.path, "utf8");
        const sfc = _compilersfc.parse.call(void 0, content);
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
          resolveDir: _path2.default.dirname(args.path)
        };
      });
      build.onLoad({filter: /\?vue&type=template/, namespace: "vue"}, async (args) => {
        const filepath = removeQuery(args.path);
        const source = await _fs2.default.promises.readFile(filepath, "utf8");
        const {descriptor} = _compilersfc.parse.call(void 0, source);
        if (descriptor.template) {
          const hasScoped = descriptor.styles.some((s) => s.scoped);
          const id = genId(filepath);
          const compiled = _compilersfc.compileTemplate.call(void 0, {
            source: descriptor.template.content,
            filename: filepath,
            id,
            scoped: hasScoped,
            compilerOptions: {
              scopeId: hasScoped ? `data-v-${id}` : void 0
            }
          });
          return {
            resolveDir: _path2.default.dirname(filepath),
            contents: compiled.code
          };
        }
      });
      build.onLoad({filter: /\?vue&type=script/, namespace: "vue"}, async (args) => {
        const filepath = removeQuery(args.path);
        const source = await _fs2.default.promises.readFile(filepath, "utf8");
        const {descriptor} = _compilersfc.parse.call(void 0, source, {filename: filepath});
        if (descriptor.script) {
          const compiled = _compilersfc.compileScript.call(void 0, descriptor, {
            id: genId(filepath)
          });
          return {
            resolveDir: _path2.default.dirname(filepath),
            contents: compiled.content,
            loader: compiled.lang === "ts" ? "ts" : "js"
          };
        }
      });
      build.onLoad({filter: /\?vue&type=style/, namespace: "vue"}, async (args) => {
        const filepath = removeQuery(args.path);
        const source = await _fs2.default.promises.readFile(filepath, "utf8");
        const {descriptor} = _compilersfc.parse.call(void 0, source);
        if (descriptor.styles.length > 0) {
          const id = genId(filepath);
          let content = "";
          for (const style of descriptor.styles) {
            const compiled = await _compilersfc.compileStyleAsync.call(void 0, {
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
            resolveDir: _path2.default.dirname(filepath),
            contents: content,
            loader: "css"
          };
        }
      });
    }
  };
};


exports.default = src_default;
