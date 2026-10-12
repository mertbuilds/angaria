'use client';

import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion';
import { create, defaultMarker, props as stylexProps, when } from '@stylexjs/stylex';
import type { StyleXStyles } from '@stylexjs/stylex';
import { ChevronDownIcon } from 'lucide-react';
import { colors } from '../lib/tokens.stylex.ts';
import { customClassName } from '../lib/utils.stylex.ts';
import { motion } from '../tokens.stylex.ts';

const LESS_MOTION = '@media (prefers-reduced-motion: reduce)';

const styles = create({
  // Turns over as the answer opens, and takes the text's color then and on hover.
  chevron: {
    color: {
      default: colors.mutedForeground,
      [when.ancestor(':hover')]: colors.foreground,
      [when.ancestor('[data-panel-open]')]: colors.foreground,
    },
    flexShrink: 0,
    height: 16,
    rotate: {
      default: '0deg',
      [when.ancestor('[data-panel-open]')]: '180deg',
    },
    transitionDuration: {
      default: motion.move,
      [LESS_MOTION]: '0s',
    },
    transitionProperty: 'rotate, color',
    transitionTimingFunction: motion.ease,
    width: 16,
  },
  header: {
    font: 'inherit',
    margin: 0,
  },
  // Questions part by a hairline between them, none above the first.
  item: {
    borderBlockStartColor: {
      ':first-child': 'transparent',
      default: colors.border,
    },
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: 1,
  },
  // The answer opens to its own height and comes into view as it does; under
  // reduced motion it is there or it is not.
  panel: {
    height: {
      ':is([data-ending-style])': 0,
      ':is([data-starting-style])': 0,
      default: 'var(--accordion-panel-height)',
    },
    opacity: {
      ':is([data-ending-style])': 0,
      ':is([data-starting-style])': 0,
      default: 1,
    },
    overflow: 'hidden',
    transitionDuration: {
      default: motion.move,
      [LESS_MOTION]: '0s',
    },
    transitionProperty: 'height, opacity',
    transitionTimingFunction: motion.ease,
  },
  panelBody: {
    color: colors.mutedForeground,
    margin: 0,
    paddingBlockEnd: '1rem',
    textWrap: 'pretty',
  },
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  trigger: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderStyle: 'none',
    borderWidth: 0,
    color: 'inherit',
    cursor: 'pointer',
    display: 'flex',
    font: 'inherit',
    fontWeight: 500,
    gap: '1rem',
    justifyContent: 'space-between',
    outlineColor: colors.ring,
    outlineOffset: '2px',
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: '2px',
    paddingBlock: '1rem',
    paddingInline: 0,
    textAlign: 'start',
    textWrap: 'pretty',
    width: '100%',
  },
});

type AccordionProps = Omit<AccordionPrimitive.Root.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

/**
 * Questions that open one answer under each, all closed at first, each on its
 * own. Every question is a button: Tab moves between them, Enter or Space
 * opens and closes one. A closed answer stays in the page
 * (`hidden="until-found"`), so find in page and search engines still read it.
 */
const Accordion = ({
  className,
  hiddenUntilFound = true,
  multiple = true,
  style,
  ...props
}: AccordionProps) => (
  <AccordionPrimitive.Root
    data-slot="accordion"
    hiddenUntilFound={hiddenUntilFound}
    multiple={multiple}
    {...stylexProps(styles.root, customClassName(className), style)}
    {...props}
  />
);

type AccordionItemProps = Omit<AccordionPrimitive.Item.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

const AccordionItem = ({ className, style, ...props }: AccordionItemProps) => (
  <AccordionPrimitive.Item
    data-slot="accordion-item"
    {...stylexProps(styles.item, customClassName(className), style)}
    {...props}
  />
);

type AccordionTriggerProps = Omit<AccordionPrimitive.Trigger.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

/** The question, in a heading, with the chevron that turns as its answer opens. */
const AccordionTrigger = ({ children, className, style, ...props }: AccordionTriggerProps) => (
  <AccordionPrimitive.Header {...stylexProps(styles.header)}>
    <AccordionPrimitive.Trigger
      data-slot="accordion-trigger"
      {...stylexProps(styles.trigger, defaultMarker(), customClassName(className), style)}
      {...props}
    >
      {children}
      <ChevronDownIcon aria-hidden="true" strokeWidth={2.25} {...stylexProps(styles.chevron)} />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
);

type AccordionPanelProps = Omit<AccordionPrimitive.Panel.Props, 'className' | 'style'> & {
  className?: string | undefined;
  style?: StyleXStyles | undefined;
};

/** The answer under its question. */
const AccordionPanel = ({ children, className, style, ...props }: AccordionPanelProps) => (
  <AccordionPrimitive.Panel
    data-slot="accordion-panel"
    {...stylexProps(styles.panel, customClassName(className))}
    {...props}
  >
    <p {...stylexProps(styles.panelBody, style)}>{children}</p>
  </AccordionPrimitive.Panel>
);

export { Accordion, AccordionItem, AccordionPanel, AccordionTrigger };

export type { AccordionItemProps, AccordionPanelProps, AccordionProps, AccordionTriggerProps };
