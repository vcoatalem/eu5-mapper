import React, { forwardRef, MouseEventHandler } from "react";
import { ColorHelper } from "../lib/drawing/color.helper";
import { greenToRedGradient } from "../lib/drawing/greenToRedGradient.const";

type FormatedProximityCostProps = {
  proximityCost: number;
  className?: string;
  onMouseEnter?: MouseEventHandler<HTMLSpanElement>;
  onMouseLeave?: MouseEventHandler<HTMLSpanElement>;
};

export const FormatedProximityCost = forwardRef<
  HTMLSpanElement,
  FormatedProximityCostProps
>(({ proximityCost, className, onMouseEnter, onMouseLeave }, ref) => {
  const proximityCostUpperBound = 50;
  const proximityCostPercentage =
    (proximityCost * 100) / proximityCostUpperBound;
  const color =
    greenToRedGradient[
      Math.max(Math.min(Math.floor(proximityCostPercentage), 100), 0)
    ];
  const hexColor = ColorHelper.rgbToHex(color[0], color[1], color[2]);

  return (
    <span
      ref={ref}
      className={className}
      style={{ color: hexColor }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {proximityCost.toFixed(2)}
    </span>
  );
});
