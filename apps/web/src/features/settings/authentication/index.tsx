import { useEnabledProviders } from "./components/hooks";
import { PasskeysSection } from "./components/passkeys";
import { PasswordSection } from "./components/password";
import { SocialProviderSection } from "./components/social-provider";
import { TwoFactorSection } from "./components/two-factor";

export function AuthenticationSettingsPage() {
	const { enabledProviders } = useEnabledProviders();

	return (
		<div className="grid max-w-xl gap-4">
			<PasswordSection />

			<TwoFactorSection />

			<PasskeysSection />

			{"google" in enabledProviders && <SocialProviderSection provider="google" animationDelay={0.4} />}

			{"github" in enabledProviders && <SocialProviderSection provider="github" animationDelay={0.5} />}

			{"linkedin" in enabledProviders && <SocialProviderSection provider="linkedin" animationDelay={0.6} />}

			{"custom" in enabledProviders && (
				<SocialProviderSection provider="custom" animationDelay={0.7} name={enabledProviders.custom} />
			)}
		</div>
	);
}
