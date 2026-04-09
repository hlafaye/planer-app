/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import {
  BUSINESS_PLAN_FEATURES,
  ENTERPRISE_PLAN_FEATURES,
  PLANE_COMMUNITY_PRODUCTS,
  PRO_PLAN_FEATURES,
  SUBSCRIPTION_REDIRECTION_URLS,
  SUBSCRIPTION_WEBPAGE_URLS,
  TALK_TO_SALES_URL,
} from "@plane/constants";
import { EProductSubscriptionEnum } from "@plane/types";
import { EModalWidth, ModalCore } from "@plane/ui";
import { cn } from "@plane/utils";
// components
import { FreePlanCard, PlanUpgradeCard } from "@/components/license";
import type { TCheckoutParams } from "@/components/license/modal/card/checkout-button";

// Constants
const COMMON_CARD_CLASSNAME = "flex flex-col w-full h-full justify-end col-span-12 sm:col-span-6 xl:col-span-3";
const COMMON_EXTRA_FEATURES_CLASSNAME = "pt-2 text-center text-caption-md-medium text-accent-primary hover:underline";

export type PaidPlanUpgradeModalProps = {
  isOpen: boolean;
  handleClose: () => void;
};

export const PaidPlanUpgradeModal = observer(function PaidPlanUpgradeModal(_props: PaidPlanUpgradeModalProps) {
  return null;
});
