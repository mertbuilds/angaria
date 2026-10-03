import { create, props as stylexProps } from '@stylexjs/stylex';
import { Children, cloneElement, Fragment, isValidElement, type ReactNode } from 'react';

/**
 * Text whose caps, not its line box, sit in the middle. Suisse Intl's ascent
 * (1.174em) and descent (0.556em) put the cap-height center about 0.05em above
 * the center of the line box, so text that a flex row centers rides high next
 * to an icon the same row centers. `text-box` trims the box to the cap height
 * and the baseline; the padding gives the line its height back, so the layout
 * is the same with or without support (Safari 18.2, Chrome 133).
 */
export const capStyles = create({
  text: {
    paddingBlock: {
      '@supports (text-box: trim-both cap alphabetic)': 'calc((1lh - 1cap) / 2)',
      default: null,
    },
    textBox: {
      '@supports (text-box: trim-both cap alphabetic)': 'trim-both cap alphabetic',
      default: null,
    },
  },
});

const isText = (node: ReactNode): node is number | string =>
  typeof node === 'string' || typeof node === 'number';

// Children in order, with fragments opened (a conditional `<>Label<Icon /></>`
// is still a label and an icon) and keys kept unique across the levels.
function flatten(children: ReactNode, prefix: string, out: Array<ReactNode>) {
  for (const child of Children.toArray(children)) {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      flatten(child.props.children, `${prefix}${child.key}`, out);
    } else if (isValidElement(child) && prefix) {
      out.push(cloneElement(child, { key: `${prefix}${child.key}` }));
    } else {
      out.push(child);
    }
  }
}

/**
 * Wraps each run of bare text among `children` in a cap-centered span (see
 * `capStyles`); elements pass through. For flex rows that mix text and icons:
 * a flex container's own text is an anonymous box that no style reaches.
 */
export function capText(children: ReactNode): ReactNode {
  const nodes: Array<ReactNode> = [];
  flatten(children, '', nodes);
  if (!nodes.some((node) => isText(node) && String(node).trim())) {
    return children;
  }

  const out: Array<ReactNode> = [];
  let run = '';
  const flush = () => {
    if (run.trim()) {
      out.push(
        <span key={`text-${out.length}`} {...stylexProps(capStyles.text)}>
          {run}
        </span>,
      );
    } else if (run) {
      out.push(run);
    }
    run = '';
  };
  for (const node of nodes) {
    if (isText(node)) {
      run += String(node);
    } else {
      flush();
      out.push(node);
    }
  }
  flush();
  return out;
}
