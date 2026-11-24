"use client";

import type { SpringOptions } from "framer-motion";
import { useRef, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

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

const springValues: SpringOptions = {
  damping: 30,
  stiffness: 100,
  mass: 2,
};

export function TiltedCard({
  imageSrc,
  altText = "Course cover image",
  captionText = "",
  containerHeight = "380px",
  containerWidth = "100%",
  imageHeight = "100%",
  imageWidth = "100%",
  scaleOnHover = 1.03,
  rotateAmplitude = 10,
  showMobileWarning = false,
  showTooltip = false,
  overlayContent = null,
  displayOverlayContent = true,
  backContent = null,
  defaultFlipped = false,
  onFlipChange,
  className = "",
}: TiltedCardProps) {
  const ref = useRef<HTMLElement>(null);
  const [isFlipped, setIsFlipped] = useState(defaultFlipped);
  const [lastY, setLastY] = useState(0);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useMotionValue(0), springValues);
  const rotateY = useSpring(useMotionValue(0), springValues);
  const scale = useSpring(1, springValues);
  const opacity = useSpring(0);
  const rotateFigcaption = useSpring(0, {
    stiffness: 350,
    damping: 30,
    mass: 1,
  });

  function handleMouse(e: React.MouseEvent<HTMLElement>) {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;

    const rotationX = (offsetY / (rect.height / 2)) * -rotateAmplitude;
    const rotationY = (offsetX / (rect.width / 2)) * rotateAmplitude;

    rotateX.set(rotationX);
    rotateY.set(rotationY);

    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);

    const velocityY = offsetY - lastY;
    rotateFigcaption.set(-velocityY * 0.6);
    setLastY(offsetY);
  }

  function handleMouseEnter() {
    scale.set(scaleOnHover);
    opacity.set(1);
  }

  function handleMouseLeave() {
    opacity.set(0);
    scale.set(1);
    rotateX.set(0);
    rotateY.set(0);
    rotateFigcaption.set(0);
  }

  function handleToggleFlip(e: React.MouseEvent<HTMLElement>) {
    if (!backContent) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, [data-no-flip='true']")) {
      return;
    }
    const next = !isFlipped;
    setIsFlipped(next);
    onFlipChange?.(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLElement>) {
    if (!backContent) return;
    if (e.key === "Enter" || e.key === " ") {
      const target = e.target as HTMLElement;
      if (target.closest("button, a, [data-no-flip='true']")) {
        return;
      }
      e.preventDefault();
      const next = !isFlipped;
      setIsFlipped(next);
      onFlipChange?.(next);
    }
  }

  return (
    <figure
      ref={ref}
      className={`tilted-card-figure ${className}`}
      style={{
        height: containerHeight,
        width: containerWidth,
      }}
      tabIndex={backContent ? 0 : undefined}
      role={backContent ? "button" : undefined}
      aria-pressed={backContent ? isFlipped : undefined}
      onMouseMove={handleMouse}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleToggleFlip}
      onKeyDown={handleKeyDown}
    >
      {showMobileWarning && (
        <div className="tilted-card-mobile-alert">
          Tap card to flip for course details
        </div>
      )}

      <motion.div
        className="tilted-card-inner"
        style={{
          width: "100%", // التعديل هنا: خليتها 100% عشان تاخد مساحة الأب
          height: "100%", // التعديل هنا: خليتها 100% عشان تاخد مساحة الأب
          rotateX,
          rotateY,
          scale,
        }}
      >
        <div className={`tilted-card-flipper ${isFlipped ? "is-flipped" : ""}`}>
          <div className="tilted-card-face tilted-card-front border border-[#E5E3DF] bg-[#11131F] shadow-lg dark:border-[#252630]">
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={altText}
                className="tilted-card-img"
                style={{
                  width: "100%", // التعديل هنا
                  height: "100%", // التعديل هنا
                  objectFit: "cover", // تأكيد إن الصورة تغطي المكان
                }}
              />
            ) : (
              <div className="tilted-card-img bg-gradient-to-br from-[#17181A] via-[#252630] to-[#11131F]" />
            )}

            {displayOverlayContent && overlayContent && (
              <motion.div className="tilted-card-overlay">
                {overlayContent}
              </motion.div>
            )}
          </div>

          {backContent && (
            <div className="tilted-card-face tilted-card-back border border-[#C99A22]/50 bg-[#FFFFFF] text-[#202124] shadow-2xl dark:bg-[#17181A] dark:text-[#F5F5F5]">
              {backContent}
            </div>
          )}
        </div>
      </motion.div>

      {showTooltip && captionText && (
        <motion.figcaption
          className="tilted-card-caption"
          style={{
            x,
            y,
            opacity,
            rotate: rotateFigcaption,
          }}
        >
          {captionText}
        </motion.figcaption>
      )}
    </figure>
  );
}

export default TiltedCard;