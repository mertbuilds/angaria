import { Tabs, TabsContent, TabsList, TabsTrigger } from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { brand, reveal } from '../lib/brand.stylex.ts';
import type { Plan } from '../lib/config.ts';
import { layout } from '../lib/layout.ts';
import { m } from '../paraglide/messages.js';
import { CheckoutButton } from './cta.tsx';

/** Each plan's price in lira, for the structured data. The card shows the pricing_ messages. */
export const PRICES_TRY: Record<Plan, number> = { monthly: 199, yearly: 1499 };

const styles = create({
  check: {
    color: brand.ink,
    flexShrink: 0,
    height: 16,
    marginBlockStart: 4,
    width: 16,
  },
  // The selected plan's blue pill, sliding under the two equal tabs.
  perk: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: spacing.s2,
  },
  pill: {
    backgroundColor: brand.fill,
    borderRadius: radius.full,
    bottom: 2,
    left: 2,
    pointerEvents: 'none',
    position: 'absolute',
    top: 2,
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '260ms',
    },
    transitionProperty: 'translate',
    transitionTimingFunction: reveal.ease,
    width: 'calc(50% - 2px)',
  },
  pillMonthly: {
    translate: '100% 0',
  },
  // Both panels stay mounted in one grid cell, so the card keeps the taller
  // panel's height and nothing below it moves when the plan changes.
  plan: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: 'inherit',
    gap: spacing.s1,
    gridColumn: '1',
    gridRow: '1',
    // Back to base.css's keyboard focus ring: the panel is a tab stop.
    outline: null,
    // The prices cross-fade: the new one rises a little as the old one goes.
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '200ms',
    },
    transitionProperty: 'opacity, translate, visibility',
    transitionTimingFunction: reveal.ease,
  },
  // The inactive panel keeps Base UI's `hidden` and `inert`; its box still
  // counts for the height, its content does not show.
  planHidden: {
    opacity: 0,
    translate: '0 4px',
    visibility: 'hidden',
  },
  plans: {
    alignSelf: 'stretch',
    gap: spacing.s4,
  },
  price: {
    alignItems: 'baseline',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  priceAmount: {
    fontSize: 36,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightMedium,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  // One narrow card in the middle of the column.
  pricing: {
    alignItems: 'flex-start',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    marginInline: 'auto',
    maxWidth: 440,
    padding: spacing.s6,
  },
  // A small radius, not a pill: on a phone the note wraps to two lines.
  saving: {
    alignSelf: 'flex-start',
    backgroundColor: brand.tint,
    borderRadius: 6,
    color: brand.ink,
    fontSize: font.sizeSm,
    marginBlockStart: spacing.s1,
    paddingBlock: 2,
    paddingInline: spacing.s2,
  },
  stack: {
    display: 'grid',
  },
  // Two equal columns, so the pill moves by exactly its own width.
  switch: {
    alignSelf: 'center',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    position: 'relative',
  },
  // Above the pill: the selected label reads black on it, the other stays gray.
  tab: {
    backgroundColor: 'transparent',
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${colors.bg}, 0 0 0 2px ${brand.ink}`,
      default: null,
    },
    paddingInline: spacing.s4,
    transitionProperty: 'color, box-shadow',
    zIndex: 1,
  },
  tabActive: {
    color: '#000000',
  },
});

/** The pricing card: a yearly or monthly plan, and the checkout of the one picked. */
export function Pricing() {
  const [plan, setPlan] = useState<Plan>('yearly');

  return (
    <div {...props(styles.pricing)}>
      <Tabs
        onValueChange={(value) => setPlan(value === 'monthly' ? 'monthly' : 'yearly')}
        style={styles.plans}
        value={plan}
      >
        <TabsList aria-label={m.pricing_plans()} style={styles.switch}>
          <span
            aria-hidden="true"
            {...props(styles.pill, plan === 'monthly' && styles.pillMonthly)}
          />
          <TabsTrigger style={[styles.tab, plan === 'yearly' && styles.tabActive]} value="yearly">
            {m.pricing_yearly()}
          </TabsTrigger>
          <TabsTrigger style={[styles.tab, plan === 'monthly' && styles.tabActive]} value="monthly">
            {m.pricing_monthly()}
          </TabsTrigger>
        </TabsList>
        <div {...props(styles.stack)}>
          <TabsContent
            keepMounted
            style={[styles.plan, plan !== 'yearly' && styles.planHidden]}
            value="yearly"
          >
            <Price amount={m.pricing_yearly_amount()} period={m.pricing_yearly_period()} />
            <p {...props(layout.text, styles.saving)}>{m.pricing_yearly_saving()}</p>
          </TabsContent>
          <TabsContent
            keepMounted
            style={[styles.plan, plan !== 'monthly' && styles.planHidden]}
            value="monthly"
          >
            <Price amount={m.pricing_monthly_amount()} period={m.pricing_monthly_period()} />
          </TabsContent>
        </div>
      </Tabs>
      <ul {...props(layout.list)}>
        <Perk>{m.pricing_trial()}</Perk>
        <Perk>{m.pricing_cancel()}</Perk>
        <Perk>{m.pricing_devices()}</Perk>
      </ul>
      <CheckoutButton location="pricing" plan={plan} variant="default" />
      <p {...props(layout.text, layout.muted, layout.small)}>{m.pricing_note()}</p>
    </div>
  );
}

function Price({ amount, period }: { amount: string; period: string }) {
  return (
    <p {...props(layout.text, styles.price)}>
      <span {...props(styles.priceAmount)}>{amount}</span>
      <span {...props(layout.muted)}>{period}</span>
    </p>
  );
}

function Perk({ children }: { children: string }) {
  return (
    <li {...props(styles.perk)}>
      <Check aria-hidden="true" {...props(styles.check)} />
      <span>{children}</span>
    </li>
  );
}
