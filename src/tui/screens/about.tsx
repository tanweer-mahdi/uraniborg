import React from "react";
import { Text } from "ink";

import { Section } from "../components.js";

export function AboutScreen(): React.JSX.Element {
  return (
    <Section title="What is Uraniborg?">
      <Text>
        Uraniborg is an iterative peer-review and refinement loop for research
        drafts. You point it at a draft, choose the review and revision models,
        set the number of iterations, and let Uraniborg improve the draft
        through repeated review-refine cycles.
      </Text>
      <Text>
        Uraniborg uses Feynman as the peer-review backend and serves as a
        lightweight orchestration layer on top of it.
      </Text>
      <Text color="cyan">https://www.feynman.is/</Text>
    </Section>
  );
}
