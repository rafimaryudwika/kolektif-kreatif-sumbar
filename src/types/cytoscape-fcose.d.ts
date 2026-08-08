/**
 * `cytoscape-fcose` ships no type declarations and has no `@types` package, so
 * the two things this app touches are declared here: the extension value handed
 * to `cytoscape.use()`, and the subset of layout options we set.
 *
 * `FcoseLayoutOptions` extends `BaseLayoutOptions`, which is a member of
 * cytoscape's own `LayoutOptions` union, so a value of this type reaches
 * `cy.layout()` without a cast. Assigning the object to a typed variable before
 * passing it is what keeps excess-property checking from rejecting the
 * fcose-only keys — a literal argument would be checked against the union
 * member it matches and fail on `nodeSeparation` and friends.
 */
declare module 'cytoscape-fcose' {
  import type { BaseLayoutOptions, Ext, NodeSingular } from 'cytoscape';

  export interface FcoseLayoutOptions extends BaseLayoutOptions {
    name: 'fcose';
    /** `proof` spends more iterations for a stabler result; fine at this size. */
    quality?: 'draft' | 'default' | 'proof';
    randomize?: boolean;
    animate?: boolean;
    animationDuration?: number;
    animationEasing?: string;
    fit?: boolean;
    padding?: number;
    nodeSeparation?: number;
    idealEdgeLength?: number;
    nodeRepulsion?: number | ((node: NodeSingular) => number);
    numIter?: number;
    tile?: boolean;
    uniformNodeDimensions?: boolean;
  }

  const fcose: Ext;
  export default fcose;
}
