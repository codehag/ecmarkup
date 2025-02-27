import type { Context } from './Context';
import type { Node as EcmarkdownNode, OrderedListItemNode } from 'ecmarkdown';
import type { PartialBiblioEntry, StepBiblioEntry } from './Biblio';

import Builder from './Builder';
import { warnEmdFailure, wrapEmdFailure } from './utils';
import { collectNonterminalsFromEmd } from './lint/utils';
import * as emd from 'ecmarkdown';

function findLabeledSteps(root: EcmarkdownNode) {
  const steps: OrderedListItemNode[] = [];
  emd.visit(root, {
    enter(node: EcmarkdownNode) {
      if (node.name === 'ordered-list-item' && node.attrs.some(a => a.key === 'id')) {
        steps.push(node);
      }
    },
  });
  return steps;
}

/*@internal*/
export default class Algorithm extends Builder {
  static async enter(context: Context) {
    context.inAlg = true;
    const { spec, node, clauseStack } = context;

    // Mark all "the result of evaluation Foo" language as having the
    // "user-code" effect. Do this before ecmarkdown, otherwise productions like
    // |Foo| get turned into tags and the regexp gets complicated.
    const innerHTML = node.innerHTML.replace(
      /the result of evaluating ([a-zA-Z_|0-9]+)/g,
      'the result of <emu-meta effects="user-code">evaluating $1</emu-meta>'
    ); // TODO use original slice, forward this from linter

    let emdTree;
    try {
      emdTree = emd.parseAlgorithm(innerHTML);
    } catch (e: any) {
      if (!('ecmarkdownTree' in node)) {
        // if it is present, we've already warned earlier
        warnEmdFailure(spec.warn, node, e);
      }
    }
    if (emdTree == null) {
      node.innerHTML = wrapEmdFailure(innerHTML);
      return;
    }

    // @ts-ignore
    node.ecmarkdownTree = emdTree;

    if (spec.opts.lintSpec && spec.locate(node) != null && !node.hasAttribute('example')) {
      const clause = clauseStack[clauseStack.length - 1];
      const namespace = clause ? clause.namespace : spec.namespace;
      const nonterminals = collectNonterminalsFromEmd(emdTree).map(({ name, loc }) => ({
        name,
        loc,
        node,
        namespace,
      }));
      spec._ntStringRefs = spec._ntStringRefs.concat(nonterminals);

      const returnType = clause?.signature?.return;
      let containsAnyCompletionyThings = false;
      if (returnType?.kind != null) {
        function checkForCompletionyStuff(list: emd.OrderedListNode) {
          for (const step of list.contents) {
            if (
              step.contents[0].name === 'text' &&
              /^(note|assert):/i.test(step.contents[0].contents)
            ) {
              continue;
            }
            if (
              step.contents.some(
                c => c.name === 'text' && /a new (\w+ )?Abstract Closure/i.test(c.contents)
              )
            ) {
              continue;
            }
            for (const part of step.contents) {
              if (part.name !== 'text') {
                continue;
              }
              const completionyThing = part.contents.match(
                /\b(ReturnIfAbrupt|throw|Return (Normal|Throw)?Completion|the result of evaluating)\b|(?<=[\s(])\?\s/i
              );
              if (completionyThing != null) {
                if (returnType?.kind === 'completion') {
                  containsAnyCompletionyThings = true;
                } else if (clause.aoid !== 'GeneratorStart') {
                  // TODO: remove above exception when the spec is more coherent (https://github.com/tc39/ecma262/pull/2429)
                  spec.warn({
                    type: 'contents',
                    ruleId: 'completiony-thing-in-non-completion-algorithm',
                    message:
                      'this would return a Completion Record, but the containing AO is declared not to return a Completion Record',
                    node,
                    nodeRelativeLine: part.location.start.line,
                    nodeRelativeColumn: part.location.start.column + completionyThing.index!,
                  });
                }
              }
            }
            if (step.sublist?.name === 'ol') {
              checkForCompletionyStuff(step.sublist);
            }
          }
        }
        checkForCompletionyStuff(emdTree.contents);

        // TODO: remove 'GeneratorYield' when the spec is more coherent (https://github.com/tc39/ecma262/pull/2429)
        // TODO: remove SDOs after doing the work necessary to coordinate the `containsAnyCompletionyThings` bit across all the piecewise components of an SDO's definition
        if (
          !['Completion', 'GeneratorYield'].includes(clause.aoid!) &&
          returnType?.kind === 'completion' &&
          !containsAnyCompletionyThings &&
          !['sdo', 'internal method', 'concrete method'].includes(clause.type!)
        ) {
          spec.warn({
            type: 'node',
            ruleId: 'completion-algorithm-lacks-completiony-thing',
            message:
              'this algorithm is declared as returning a Completion Record, but there is no step which might plausibly return an abrupt completion',
            node,
          });
        }
      }
    }

    const rawHtml = emd.emit(emdTree);

    // replace spaces after !/? with &nbsp; to prevent bad line breaking
    const html = rawHtml.replace(/((?:\s+|>)[!?])[ \t]+/g, '$1&nbsp;');
    node.innerHTML = html;

    const labeledStepEntries: StepBiblioEntry[] = [];
    const replaces = node.getAttribute('replaces-step');
    if (replaces) {
      context.spec.replacementAlgorithms.push({
        element: node,
        target: replaces,
      });
      context.spec.replacementAlgorithmToContainedLabeledStepEntries.set(node, labeledStepEntries);
    }

    if (replaces && node.firstElementChild!.children.length > 1) {
      const labeledSteps = findLabeledSteps(emdTree);
      for (const step of labeledSteps) {
        const itemSource = innerHTML.slice(step.location.start.offset, step.location.end.offset);
        const offset = itemSource.match(/^.*?[ ,[]id *= *"/)![0].length;
        spec.warn({
          type: 'contents',
          ruleId: 'labeled-step-in-replacement',
          message:
            'labeling a step in a replacement algorithm which has multiple top-level steps is unsupported because the resulting step number would be ambiguous',
          node,
          nodeRelativeLine: step.location.start.line,
          nodeRelativeColumn: step.location.start.column + offset,
        });
      }
    }

    for (const step of node.querySelectorAll('li[id]')) {
      const entry: PartialBiblioEntry = {
        type: 'step',
        id: step.id,
        stepNumbers: getStepNumbers(step),
      };
      context.spec.biblio.add(entry);
      if (replaces) {
        // The biblio entries for labeled steps in replacement algorithms will be modified in-place by a subsequent pass
        labeledStepEntries.push(entry as StepBiblioEntry);
        context.spec.labeledStepsToBeRectified.add(step.id);
      }
    }
  }

  static exit(context: Context) {
    context.inAlg = false;
  }
  static elements = ['EMU-ALG'];
}

function getStepNumbers(item: Element) {
  const { indexOf } = Array.prototype;
  const counts = [];
  while (item.parentElement?.tagName === 'OL') {
    counts.unshift(1 + indexOf.call(item.parentElement.children, item));
    item = item.parentElement.parentElement!;
  }
  return counts;
}
