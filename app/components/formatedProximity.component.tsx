import React, { forwardRef, MouseEventHandler } from "react";
import { ColorHelper } from "../lib/drawing/color.helper";
import { greenToRedGradient } from "../lib/drawing/greenToRedGradient.const";

type FormatedProximityProps = {
  proximity: number;
  className?: string;
  onMouseEnter?: MouseEventHandler<HTMLSpanElement>;
  onMouseLeave?: MouseEventHandler<HTMLSpanElement>;
};

export const FormatedProximity = forwardRef<
  HTMLSpanElement,
  FormatedProximityProps
>(({ proximity, className, onMouseEnter, onMouseLeave }, ref) => {
  const proximityUpperBound = 100;
  const proximityPercentage = (proximity * 100) / proximityUpperBound;
  const color =
    greenToRedGradient[
      Math.max(Math.min(100 - Math.floor(proximityPercentage), 100), 0)
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
      {proximity.toFixed(2)}
    </span>
  );
});
