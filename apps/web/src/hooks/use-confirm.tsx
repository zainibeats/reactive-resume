import * as React from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@reactive-resume/ui/components/alert-dialog";
import { cn } from "@reactive-resume/utils/style";

interface ConfirmOptions {
	description?: React.ReactNode;
	confirmText?: React.ReactNode;
	cancelText?: React.ReactNode;
}

interface ConfirmState extends ConfirmOptions {
	open: boolean;
	title: React.ReactNode;
	resolve: ((value: boolean) => void) | null;
}

type ConfirmContextType = {
	confirm: (title: React.ReactNode, options?: ConfirmOptions) => Promise<boolean>;
};

type ConfirmDialogProviderProps = {
	children: React.ReactNode;
};

const ConfirmContext = React.createContext<ConfirmContextType | null>(null);

export function ConfirmDialogProvider({ children }: ConfirmDialogProviderProps) {
	const [state, setState] = React.useState<ConfirmState>({
		open: false,
		resolve: null,
		title: "",
		description: undefined,
		confirmText: undefined,
		cancelText: undefined,
	});

	const confirm = React.useCallback(async (title: React.ReactNode, options?: ConfirmOptions): Promise<boolean> => {
		return new Promise<boolean>((resolve) => {
			setState({
				open: true,
				resolve,
				title,
				description: options?.description,
				confirmText: options?.confirmText,
				cancelText: options?.cancelText,
			});
		});
	}, []);

	const handleConfirm = React.useCallback(() => {
		if (state.resolve) state.resolve(true);

		setState((prev) => ({ ...prev, open: false, resolve: null }));
	}, [state.resolve]);

	const handleCancel = React.useCallback(() => {
		if (state.resolve) state.resolve(false);

		setState((prev) => ({ ...prev, open: false, resolve: null }));
	}, [state.resolve]);

	const contextValue = React.useMemo<ConfirmContextType>(() => ({ confirm }), [confirm]);

	return (
		<ConfirmContext.Provider value={contextValue}>
			{children}

			<AlertDialog open={state.open} onOpenChange={(open) => !open && handleCancel()}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{state.title}</AlertDialogTitle>
						<AlertDialogDescription className={cn(!state.description && "sr-only")}>
							{state.description}
						</AlertDialogDescription>
					</AlertDialogHeader>

					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleCancel}>{state.cancelText ?? "Cancel"}</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirm}>{state.confirmText ?? "Confirm"}</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</ConfirmContext.Provider>
	);
}

export function useConfirm() {
	const context = React.use(ConfirmContext);

	if (!context) {
		throw new Error("useConfirm must be used within a <ConfirmDialogProvider />.");
	}

	return context.confirm;
}
