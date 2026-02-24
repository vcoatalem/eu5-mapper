"use client";

import { CopyrightNotice } from "@/app/components/copyrightNotice.component";
import { PosthogSurveyButton } from "@/app/components/posthogSurveyButton.component";

export default function MobilePage() {
  return (
    <div className="w-100wh h-100vh bg-black text-white text-center flex flex-col items-center justify-center gap-4 mx-12 font-mono py-4 mt-8">
      <h2 className="text-stone-200">Hello ! It seems you are trying to access <b>EU5 Mapper</b> on a mobile device. </h2>
      <p className="text-stone-200">EU5 Mapper is not available on mobile for now and will not be for the foreseeable future.</p>      
      <p className="text-stone-600 u-mt-2"><i>If this is a false positive, please reach out by reaching the button below - this will help me improve the system and make sure you can access the app on your device</i></p>
      <PosthogSurveyButton />
      <hr className="w-full border-stone-600 mt-2 mb-6"></hr>
      <CopyrightNotice className="u-mt-auto"/>
    </div>
  )
}