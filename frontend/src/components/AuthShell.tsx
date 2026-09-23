import { Card, Flex, Heading, Separator, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

import { LegalLinks } from "./LegalPage";

type Props = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

/** The framed, centred card the signed-out sign-in screen sits in. */
function AuthShell({ title, subtitle, children, footer }: Props) {
  return (
    <Flex
      align="center"
      justify="center"
      className="min-h-screen bg-cream bg-cover bg-center bg-no-repeat px-4 py-10"
      style={{ backgroundImage: "url('/loginpagegb.jpg')" }}
    >
      <Card size="5" className="w-full max-w-md shadow-lg">
        <Flex direction="column" align="center" gap="4">
          <img src="/logomain.png" alt="ICF International" className="w-32 h-auto" />

          <Heading size="5" align="center">
            {title}
          </Heading>

          {subtitle && (
            <Text size="2" color="gray" align="center">
              {subtitle}
            </Text>
          )}
        </Flex>

        <Separator size="4" className="mt-4" />

        <Flex direction="column" className="mt-4">
          {children}
        </Flex>

        <Flex direction="column" align="center" gap="2" mt="4">
          {footer}
          <LegalLinks className="justify-center" />
          <Text size="1" color="gray" align="center">
            © {new Date().getFullYear()} ICF International. All rights reserved.
          </Text>
        </Flex>
      </Card>
    </Flex>
  );
}

export default AuthShell;
