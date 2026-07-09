import { Trans } from "@lingui/react/macro";
import { PasswordIcon, PencilSimpleLineIcon } from "@phosphor-icons/react";
import { Link, useNavigate } from "@tanstack/react-router";
import { m } from "motion/react";
import { useCallback } from "react";
import { Button } from "@reactive-resume/ui/components/button";
import { useDialogStore } from "@/dialogs/store";
import { useAuthAccounts } from "./hooks";

// ponytail: m.div wrapper is identical for both branches — extracted, match(boolean) removed
function ActionButton({ children }: { children: React.ReactNode }) {
	return (
		<m.div
			className="will-change-transform"
			whileHover={{ y: -1, scale: 1.01 }}
			whileTap={{ scale: 0.99 }}
			transition={{ duration: 0.14, ease: "easeOut" }}
		>
			{children}
		</m.div>
	);
}

export function PasswordSection() {
	const navigate = useNavigate();
	const { openDialog } = useDialogStore();
	const { hasAccount } = useAuthAccounts();

	const hasPassword = hasAccount("credential");

	const handleUpdatePassword = useCallback(() => {
		if (hasPassword) {
			openDialog("auth.change-password", undefined);
		} else {
			void navigate({ to: "/auth/forgot-password" });
		}
	}, [hasPassword, navigate, openDialog]);

	return (
		<m.div
			initial={{ y: -20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.2, delay: 0.1, ease: "easeOut" }}
			className="flex items-center justify-between gap-x-4 will-change-[transform,opacity]"
		>
			<h2 className="flex items-center gap-x-3 font-medium text-base">
				<PasswordIcon />
				<Trans>Password</Trans>
			</h2>

			<ActionButton>
				{hasPassword ? (
					<Button variant="outline" onClick={handleUpdatePassword}>
						<PencilSimpleLineIcon />
						<Trans>Update Password</Trans>
					</Button>
				) : (
					<Button
						variant="outline"
						nativeButton={false}
						render={
							<Link to="/auth/forgot-password">
								<Trans>Set Password</Trans>
							</Link>
						}
					/>
				)}
			</ActionButton>
		</m.div>
	);
}
