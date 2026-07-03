import {
	Body,
	Button,
	Container,
	Heading,
	Hr,
	Html,
	Link,
	Preview,
	pixelBasedPreset,
	Section,
	Tailwind,
	Text,
} from "react-email";

const appName = "Reactive Resume";

interface AuthEmailLayoutProps {
	preview: string;
	heading: string;
	intro: string;
	details?: string;
	actionLabel: string;
	actionUrl: string;
	outro: string;
}

function AuthEmailLayout({ preview, heading, intro, details, actionLabel, actionUrl, outro }: AuthEmailLayoutProps) {
	return (
		<Html lang="en">
			<Tailwind config={{ presets: [pixelBasedPreset] }}>
				<Body className="m-0 bg-zinc-950 p-0 font-sans text-sm text-zinc-50">
					<Preview>{preview}</Preview>
					<Container className="mx-auto w-full max-w-xl bg-zinc-900 p-6 text-zinc-50">
						<Section>
							<Text className="font-medium text-base">{appName}</Text>
							<Heading className="mt-6 whitespace-break-spaces font-medium text-2xl leading-0 tracking-tighter md:text-5xl">
								{heading}
							</Heading>

							<Section className="mt-6 md:mt-12">
								<Text>{intro}</Text>

								{details ? <Text className="opacity-60">{details}</Text> : null}
							</Section>

							<Button
								target="_blank"
								href={actionUrl}
								className="mt-6 box-border inline-block bg-zinc-200 px-6 py-3 text-center text-zinc-900 no-underline"
							>
								{actionLabel}
							</Button>

							<Section className="mt-8">
								<Text className="leading-0">
									If the button does not work, copy and paste this link into your browser:
								</Text>
								<Link className="text-zinc-200/60 leading-0 underline underline-offset-2" href={actionUrl}>
									{actionUrl}
								</Link>
							</Section>

							<Section className="mt-4">
								<Text className="opacity-60">{outro}</Text>
							</Section>

							<Hr className="my-10 border-zinc-700" />

							<Text className="mt-8 text-xs opacity-40">Sent by your Reactive Resume instance.</Text>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}

interface ResetPasswordEmailProps {
	url: string;
}

export function ResetPasswordEmail({ url }: ResetPasswordEmailProps) {
	return (
		<AuthEmailLayout
			preview={`Reset your ${appName} password`}
			heading="Password Reset"
			intro={`We received a request to reset your ${appName} password.`}
			details="If this was not you, you can ignore this message and your password will remain unchanged."
			actionLabel="Create New Password"
			actionUrl={url}
			outro="For security, only use links from emails sent by Reactive Resume."
		/>
	);
}

interface VerifyEmailProps {
	url: string;
}

export function VerifyEmail({ url }: VerifyEmailProps) {
	return (
		<AuthEmailLayout
			preview={`Verify your email for ${appName}`}
			heading="Verify Email"
			intro={`Thanks for signing up for ${appName}. Please verify your email address to continue.`}
			details="Verification helps us protect your account and keep your sign-in secure."
			actionLabel="Verify Email"
			actionUrl={url}
			outro="If you did not create this account, you can safely ignore this email."
		/>
	);
}

interface VerifyEmailChangeProps {
	url: string;
	previousEmail: string;
	newEmail: string;
}

export function VerifyEmailChange({ url, previousEmail, newEmail }: VerifyEmailChangeProps) {
	return (
		<AuthEmailLayout
			preview={`Confirm your new ${appName} email address`}
			heading="Confirm Email Change"
			intro={`You requested to change your ${appName} email from ${previousEmail} to ${newEmail}.`}
			details="Confirm this change to complete the update and keep your account access uninterrupted."
			actionLabel="Verify New Email"
			actionUrl={url}
			outro="If you did not request this change, ignore this email and secure your account."
		/>
	);
}
