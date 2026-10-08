import type * as React from "react";
import { cn } from "@reactive-resume/utils/style";

type SpinnerProps = React.ComponentProps<"span"> & {
	/** Hide it from assistive tech when the surrounding control already says it's busy. */
	decorative?: boolean;
};

/** A 14px ring with one transparent side. Pair it with text that says what's happening. */
function Spinner({ className, decorative = false, ...props }: SpinnerProps) {
	const semantics = decorative
		? ({ "aria-hidden": true } as const)
		: ({ role: "status", "aria-label": "Loading" } as const);

	return (
		<span
			{...semantics}
			data-slot="spinner"
			className={cn(
				"inline-block size-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-e-transparent [animation-duration:0.8s]",
				className,
			)}
			{...props}
		/>
	);
}

export { Spinner, type SpinnerProps };
