"use client";
import {StorefrontCmsSlider} from '../storefront/storefront-cms-slider';
import type { CmsBlock } from './cms-blocks';
import { CmsBlockRenderer } from '../../../packages/cms-blocks/src/react';
import { CmsSystemBlockView } from './cms-system-block-view';
import { isCmsShellModule } from './cms-shell-modules';
import { StorefrontAuthEntry } from '../storefront/storefront-auth-drawer';
import { StorefrontCartStatus } from '../storefront/cart-client';

export function renderCmsShellModulePreview(block:CmsBlock) {
  if(block.type==='slider.fullWidth')return <StorefrontCmsSlider block={block}/>;
  if (!isCmsShellModule(block.type)) return <CmsBlockRenderer block={block} />;
  return <div onClickCapture={event=>{event.preventDefault();event.stopPropagation();}} onSubmitCapture={event=>event.preventDefault()}>
    <CmsSystemBlockView block={block} categories={[]} openCustomerLogin={false}
      account={<StorefrontAuthEntry preview compact={block.props.compact!==false}/>}
      cart={<StorefrontCartStatus preview compact={block.props.compact!==false}/>}/>
  </div>;
}
