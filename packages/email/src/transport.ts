import type { SendMailOptions, Transporter } from "nodemailer";
import type { ReactElement } from "react";
import nodemailer from "nodemailer";
import { render } from "react-email";
import { env } from "@reactive-resume/env/server";

type SendEmailOptions = { to: string; subject: string; react: ReactElement };

let cachedTransport: Transporter | undefined;

const getTransport = () => {
	const { SMTP_HOST: host, SMTP_USER: user, SMTP_PASS: pass, SMTP_FROM: from } = env;
	if (!host || !user || !pass || !from) return;

	cachedTransport ??= nodemailer.createTransport({
		host,
		port: env.SMTP_PORT,
		secure: env.SMTP_SECURE,
		auth: { user, pass },
	});

	return cachedTransport;
};

export const sendEmail = async ({ to, subject, react }: SendEmailOptions) => {
	const transport = getTransport();
	const payload: SendMailOptions = {
		to,
		from: env.SMTP_FROM,
		subject,
		html: await render(react),
		text: await render(react, { plainText: true }),
	};

	if (!transport) {
		console.info("SMTP not configured; skipping email send.", {
			to: payload.to,
			subject: payload.subject,
			text: payload.text,
			html: payload.html,
		});
		return;
	}

	try {
		await transport.sendMail(payload);
	} catch (error) {
		console.error("There was an error sending mail.", error);
	}
};
