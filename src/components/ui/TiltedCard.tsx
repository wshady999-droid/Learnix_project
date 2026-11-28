"use client";

import "./TiltedCard.css";

export interface TiltedCardProps {
  imageSrc?: React.ComponentProps<"img">["src"];
  altText?: string;
  captionText?: string;
  containerHeight?: React.CSSProperties["height"];
  containerWidth?: React.CSSProperties["width"];
  imageHeight?: React.CSSProperties["height"];
  imageWidth?: React.CSSProperties["width"];
  scaleOnHover?: number;
  rotateAmplitude?: number;
  showMobileWarning?: boolean;
  showTooltip?: boolean;
  overlayContent?: React.ReactNode;
  displayOverlayContent?: boolean;
  backContent?: React.ReactNode;
  defaultFlipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  className?: string;
}

/**
 * Clean static course card surface without 3D tilt or click-to-flip animations.
 */
export function TiltedCard({
  imageSrc,
  altText = "Course cover image",
  containerHeight = "380px",
  containerWidth = "100%",
  overlayContent = null,
  displayOverlayContent = true,
  className = "",
}: TiltedCardProps) {
  return (
    <figure
      className={`tilted-card-figure ${className}`}
      style={{
        height: containerHeight,
        width: containerWidth,
      }}
    >
      <div
        className="tilted-card-inner"
        style={{
          width: "100%",
          height: "100%",
        }}
      >
        <div className="tilted-card-face tilted-card-front border border-[#E5E3DF] bg-[#11131F] shadow-lg dark:border-[#252630]">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={altText}
              className="tilted-card-img"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <div className="tilted-card-img bg-gradient-to-br from-[#17181A] via-[#252630] to-[#11131F]" />
          )}

          {displayOverlayContent && overlayContent && (
            <div className="tilted-card-overlay">{overlayContent}</div>
          )}
        </div>
      </div>
    </figure>
  );
}

export default TiltedCard;
