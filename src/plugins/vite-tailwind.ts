import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { __unstable__loadDesignSystem, compile } from '@tailwindcss/node';
import { parse } from '@vue/compiler-sfc';
import type { ModuleNode, Plugin, ViteDevServer } from 'vite';

const publicId = 'virtual:vue-anima/tailwind';
const internalId = `\0${publicId}`;

interface Ast {
  type?: string;
  value?: string;
  name?: string;
  quasis?: { value: { cooked?: string } }[];
  expressions?: Ast[];
  properties?: Ast[];
  key?: Ast;
  computed?: boolean;
}

interface CssNode {
  kind: string;
  property?: string;
  nodes?: CssNode[];
}

function goalString(ast: Ast | null | undefined): string | undefined {
  if (ast?.type === 'StringLiteral') return ast.value;
  if (ast?.type === 'TemplateLiteral' && ast.expressions?.length === 0)
    return ast.quasis?.[0]?.value.cooked;
  if (ast?.type === 'ObjectExpression') {
    for (const property of ast.properties ?? []) {
      if (
        property.type === 'ObjectProperty' &&
        !property.computed &&
        ((property.key?.type === 'Identifier' &&
          property.key.name === 'styles') ||
          (property.key?.type === 'StringLiteral' &&
            property.key.value === 'styles'))
      )
        return goalString(property.value as Ast);
    }
  }
  return undefined;
}

function collect(source: string): string[][] {
  const { descriptor } = parse(source);
  const goals: string[][] = [];
  function visit(node: unknown): void {
    if (typeof node !== 'object' || node === null) return;
    const item = node as Record<string, unknown>;
    if (item.type === 1 && Array.isArray(item.props)) {
      for (const prop of item.props) {
        if (
          typeof prop === 'object' &&
          prop !== null &&
          (prop as { type?: number }).type === 7 &&
          (prop as { name?: string }).name === 'anima'
        ) {
          const exp = (prop as { exp?: { ast?: Ast } }).exp;
          const goal = goalString(exp?.ast);
          if (goal && !goal.includes(';'))
            goals.push(goal.trim().split(/\s+/).filter(Boolean));
        }
      }
    }
    if (Array.isArray(item.children))
      for (const child of item.children) visit(child);
    if (Array.isArray(item.branches))
      for (const branch of item.branches) visit(branch);
  }
  visit(descriptor.template?.ast);
  return goals;
}

function properties(nodes: CssNode[]): string[] {
  const result = new Set<string>();
  function visit(node: CssNode): void {
    if (node.kind === 'declaration' && node.property) result.add(node.property);
    for (const child of node.nodes ?? []) visit(child);
  }
  for (const node of nodes) visit(node);
  return [...result];
}

/** Compile static v-anima class goals against the application's Tailwind CSS. */
export function animaTailwind(options: { css: string }): Plugin {
  let root = process.cwd();
  let server: ViteDevServer | undefined;
  let designSystem:
    | Promise<Awaited<ReturnType<typeof __unstable__loadDesignSystem>>>
    | undefined;
  let dependencies = new Set<string>();
  const candidatesByModule = new Map<string, Set<string>>();
  const cssPath = (): string => resolve(root, options.css);
  function system(): Promise<
    Awaited<ReturnType<typeof __unstable__loadDesignSystem>>
  > {
    designSystem ??= readFile(cssPath(), 'utf8').then(async (css) => {
      const base = dirname(cssPath());
      const loaded = new Set<string>();
      await compile(css, {
        base,
        onDependency(path): void {
          loaded.add(resolve(path));
        },
      });
      const compiler = await __unstable__loadDesignSystem(css, { base });
      dependencies = loaded;
      return compiler;
    });
    return designSystem;
  }
  return {
    name: 'vue-anima:vite-tailwind',
    enforce: 'pre',
    configureServer(devServer): void {
      server = devServer;
    },
    configResolved(config): void {
      root = config.root;
    },
    handleHotUpdate(context): ModuleNode[] | undefined {
      if (
        resolve(context.file) !== cssPath() &&
        !dependencies.has(resolve(context.file))
      )
        return undefined;
      designSystem = undefined;
      dependencies = new Set<string>();
      const module = context.server.moduleGraph.getModuleById(internalId);
      if (!module) return undefined;
      context.server.moduleGraph.invalidateModule(module);
      return context.modules.includes(module)
        ? context.modules
        : [...context.modules, module];
    },
    resolveId(id): string | undefined {
      if (id === publicId) return internalId;
      return undefined;
    },
    async load(id): Promise<string | undefined> {
      if (id !== internalId) return undefined;
      const compiler = await system();
      const names = [
        ...new Set([...candidatesByModule.values()].flatMap((set) => [...set])),
      ].sort();
      const ast = compiler.candidatesToAst(names);
      const manifest: Record<string, string[]> = {};
      names.forEach((name, index) => {
        manifest[name] = properties(ast[index] as CssNode[]);
      });
      return `export default ${JSON.stringify(manifest)};`;
    },
    async transform(source, id): Promise<undefined> {
      if (!id.endsWith('.vue')) return undefined;
      const goals = collect(source);
      const found = new Set<string>();
      if (goals.length) {
        const compiler = await system();
        this.addWatchFile(cssPath());
        for (const path of dependencies) this.addWatchFile(path);
        for (const names of goals) {
          const compiled = compiler.candidatesToCss(names);
          const invalid = names.find((_, index) => compiled[index] === null);
          if (invalid) {
            const prefix = invalid.split(':', 1)[0];
            if (
              invalid.includes(':') &&
              prefix &&
              !compiler.parseVariant(prefix)
            )
              continue;
            this.error(
              `vue-anima: Tailwind cannot compile class "${invalid}" in ${id}`,
            );
          }
          for (const name of names) found.add(name);
        }
      }
      if (found.size) candidatesByModule.set(id, found);
      else candidatesByModule.delete(id);
      const module = server?.moduleGraph.getModuleById(internalId);
      if (module) server?.moduleGraph.invalidateModule(module);
      return undefined;
    },
  };
}
