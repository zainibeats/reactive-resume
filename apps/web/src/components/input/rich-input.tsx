import type { Editor, UseEditorOptions } from "@tiptap/react";
import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import {
	ArrowsInSimpleIcon,
	ArrowsOutSimpleIcon,
	CodeBlockIcon,
	CodeSimpleIcon,
	ColumnsPlusLeftIcon,
	ColumnsPlusRightIcon,
	HighlighterCircleIcon,
	KeyReturnIcon,
	LinkBreakIcon,
	LinkIcon,
	ListBulletsIcon,
	ListNumbersIcon,
	MinusIcon,
	ParagraphIcon,
	PlusIcon,
	RowsPlusBottomIcon,
	RowsPlusTopIcon,
	TableIcon,
	TextAlignCenterIcon,
	TextAlignJustifyIcon,
	TextAlignLeftIcon,
	TextAlignRightIcon,
	TextBolderIcon,
	TextHFiveIcon,
	TextHFourIcon,
	TextHOneIcon,
	TextHSixIcon,
	TextHThreeIcon,
	TextHTwoIcon,
	TextIndentIcon,
	TextItalicIcon,
	TextOutdentIcon,
	TextStrikethroughIcon,
	TextUnderlineIcon,
	TrashSimpleIcon,
} from "@phosphor-icons/react";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { TableKit } from "@tiptap/extension-table";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { EditorContent, EditorContext, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import z from "zod";
import { Button } from "@reactive-resume/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@reactive-resume/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@reactive-resume/ui/components/dropdown-menu";
import { PopoverHeader, PopoverTitle, PopoverTrigger } from "@reactive-resume/ui/components/popover";
import { Toggle } from "@reactive-resume/ui/components/toggle";
import { isDarkColor } from "@reactive-resume/utils/color";
import { cn } from "@reactive-resume/utils/style";
import { usePrompt } from "@/hooks/use-prompt";
import { isRTL } from "@/libs/locale";
import { ColorPicker } from "./color-picker";

const defaultTextColor = "rgba(0, 0, 0, 1)";
const defaultHighlightColor = "rgba(255, 255, 0, 1)";

const extensions = [
	StarterKit.configure({
		heading: {
			levels: [1, 2, 3, 4, 5, 6],
		},
		codeBlock: {
			enableTabIndentation: true,
		},
		link: {
			openOnClick: false,
			enableClickSelection: true,
			defaultProtocol: "https",
			protocols: ["http", "https"],
		},
	}),
	TextStyle,
	Color,
	Highlight.configure({ multicolor: true }).extend({
		renderHTML({ HTMLAttributes }) {
			const color = HTMLAttributes["data-color"] as string | undefined;
			if (color && isDarkColor(color)) {
				HTMLAttributes.style = `${HTMLAttributes.style ?? ""}; color: #ffffff`;
			}
			return ["mark", HTMLAttributes, 0];
		},
	}),
	TextAlign.configure({ types: ["heading", "paragraph", "listItem"] }),
	TableKit.configure(),
];

type Props = UseEditorOptions & {
	value: string;
	onChange: (value: string) => void;
	style?: React.CSSProperties;
	className?: string;
	editorClassName?: string;
};

export function RichInput({ value, onChange, style, className, editorClassName, ...options }: Props) {
	const { i18n } = useLingui();
	const textDirection = isRTL(i18n.locale) ? "rtl" : undefined;
	const [isFullscreen, setIsFullscreen] = useState(false);

	const editor = useEditor({
		...options,
		extensions,
		textDirection,
		content: value,
		immediatelyRender: false,
		shouldRerenderOnTransaction: false,
		editorProps: {
			attributes: {
				spellcheck: "false",
				"data-editor": "true",
				"data-fullscreen": isFullscreen ? "true" : "false",
				class: cn(
					"wysiwyg group/editor overflow-y-auto p-3 pb-4",
					"rounded-md rounded-t-none border outline-none focus-visible:border-ring",
					"[td:has(.selectedCell)]:bg-primary",
					"data-[fullscreen=false]:max-h-[400px] data-[fullscreen=false]:min-h-[100px]",
					"data-[fullscreen=true]:max-h-none data-[fullscreen=true]:min-h-full",
					editorClassName,
				),
			},
		},
		onUpdate: ({ editor }) => {
			onChange(editor.getHTML());
		},
	});

	const providerValue = useMemo(() => ({ editor }), [editor]);

	useEffect(() => {
		if (!editor || editor.getHTML() === value) return;
		editor.commands.setContent(value, { emitUpdate: false });
	}, [editor, value]);

	if (!editor) return null;

	const editorElement = (
		<div className="relative">
			<EditorToolbar editor={editor} isFullscreen={isFullscreen} />

			<EditorContent editor={editor} />

			<Button
				size="icon"
				variant="secondary"
				className="absolute right-2 bottom-2 size-7"
				title={isFullscreen ? t`Exit Fullscreen` : t`Fullscreen`}
				onClick={() => setIsFullscreen(!isFullscreen)}
			>
				{isFullscreen ? <ArrowsInSimpleIcon className="size-4" /> : <ArrowsOutSimpleIcon className="size-4" />}
			</Button>
		</div>
	);

	if (isFullscreen) {
		return (
			<EditorContext value={providerValue}>
				<div className={cn("rounded-md", className)} style={style}>
					{/* Placeholder to maintain layout */}
					<div className="h-[200px] rounded-md border border-dashed" />
				</div>

				<Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
					<DialogContent className="flex h-[95svh] max-h-none! w-[95svw] max-w-none! flex-col p-4 sm:max-w-none! 2xl:max-w-none!">
						<div className="sr-only">
							<DialogTitle>
								<Trans comment="Screen reader title for the fullscreen rich-text editor dialog">
									Fullscreen Editor
								</Trans>
							</DialogTitle>
							<DialogDescription>
								<Trans comment="Screen reader description for the fullscreen rich-text editor dialog">
									Edit content in fullscreen mode
								</Trans>
							</DialogDescription>
						</div>
						{editorElement}
					</DialogContent>
				</Dialog>
			</EditorContext>
		);
	}

	return (
		<EditorContext value={providerValue}>
			<div className={cn("rounded-md", className)} style={style}>
				{editorElement}
			</div>
		</EditorContext>
	);
}

type ToolbarToggleState = {
	isActive: boolean;
	canRun: boolean;
	run: () => boolean;
};

type ToolbarButtonState = {
	canRun: boolean;
	run: () => boolean;
};

function createToolbarToggleState(editor: Editor, options: ToolbarToggleStateOptions): ToolbarToggleState {
	return {
		isActive: options.isActive(editor) ?? false,
		canRun: options.canRun(editor) ?? false,
		run: () => options.run(editor),
	};
}

function createToolbarButtonState(editor: Editor, options: ToolbarButtonStateOptions): ToolbarButtonState {
	return {
		canRun: options.canRun(editor) ?? false,
		run: () => options.run(editor),
	};
}

type ToolbarToggleStateOptions = {
	isActive: (editor: Editor) => boolean;
	canRun: (editor: Editor) => boolean;
	run: (editor: Editor) => boolean;
};

type ToolbarButtonStateOptions = {
	canRun: (editor: Editor) => boolean;
	run: (editor: Editor) => boolean;
};

const boldToolbarState = {
	isActive: (editor: Editor) => editor.isActive("bold"),
	canRun: (editor: Editor) => editor.can().chain().toggleBold().run(),
	run: (editor: Editor) => editor.chain().focus().toggleBold().run(),
} satisfies ToolbarToggleStateOptions;

const italicToolbarState = {
	isActive: (editor: Editor) => editor.isActive("italic"),
	canRun: (editor: Editor) => editor.can().chain().toggleItalic().run(),
	run: (editor: Editor) => editor.chain().focus().toggleItalic().run(),
} satisfies ToolbarToggleStateOptions;

const underlineToolbarState = {
	isActive: (editor: Editor) => editor.isActive("underline"),
	canRun: (editor: Editor) => editor.can().chain().toggleUnderline().run(),
	run: (editor: Editor) => editor.chain().focus().toggleUnderline().run(),
} satisfies ToolbarToggleStateOptions;

const strikeToolbarState = {
	isActive: (editor: Editor) => editor.isActive("strike"),
	canRun: (editor: Editor) => editor.can().chain().toggleStrike().run(),
	run: (editor: Editor) => editor.chain().focus().toggleStrike().run(),
} satisfies ToolbarToggleStateOptions;

const inlineCodeToolbarState = {
	isActive: (editor: Editor) => editor.isActive("code"),
	canRun: (editor: Editor) => editor.can().chain().toggleCode().run(),
	run: (editor: Editor) => editor.chain().focus().toggleCode().run(),
} satisfies ToolbarToggleStateOptions;

const codeBlockToolbarState = {
	isActive: (editor: Editor) => editor.isActive("codeBlock"),
	canRun: (editor: Editor) => editor.can().chain().toggleCodeBlock().run(),
	run: (editor: Editor) => editor.chain().focus().toggleCodeBlock().run(),
} satisfies ToolbarToggleStateOptions;

function createHeadingToolbarState(editor: Editor, level: 1 | 2 | 3 | 4 | 5 | 6): ToolbarToggleState {
	return createToolbarToggleState(editor, {
		isActive: (editor) => editor.isActive("heading", { level }),
		canRun: (editor) => editor.can().chain().toggleHeading({ level }).run(),
		run: (editor) => editor.chain().focus().toggleHeading({ level }).run(),
	});
}

function createTextAlignToolbarState(editor: Editor, textAlign: "left" | "center" | "right" | "justify") {
	return createToolbarToggleState(editor, {
		isActive: (editor) => editor.isActive({ textAlign }),
		canRun: (editor) => editor.can().chain().toggleTextAlign(textAlign).run(),
		run: (editor) => editor.chain().focus().toggleTextAlign(textAlign).run(),
	});
}

const bulletListToolbarState = {
	isActive: (editor: Editor) => editor.isActive("bulletList"),
	canRun: (editor: Editor) => editor.can().chain().toggleBulletList().run(),
	run: (editor: Editor) => editor.chain().focus().toggleBulletList().run(),
} satisfies ToolbarToggleStateOptions;

const orderedListToolbarState = {
	isActive: (editor: Editor) => editor.isActive("orderedList"),
	canRun: (editor: Editor) => editor.can().chain().toggleOrderedList().run(),
	run: (editor: Editor) => editor.chain().focus().toggleOrderedList().run(),
} satisfies ToolbarToggleStateOptions;

const liftListItemToolbarState = {
	canRun: (editor: Editor) => editor.can().chain().liftListItem("listItem").run(),
	run: (editor: Editor) => editor.chain().focus().liftListItem("listItem").run(),
} satisfies ToolbarButtonStateOptions;

const sinkListItemToolbarState = {
	canRun: (editor: Editor) => editor.can().chain().sinkListItem("listItem").run(),
	run: (editor: Editor) => editor.chain().focus().sinkListItem("listItem").run(),
} satisfies ToolbarButtonStateOptions;

const tableToolbarStates = {
	insertTable: {
		canRun: (editor: Editor) => editor.can().chain().insertTable().run(),
		run: (editor: Editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
	},
	addColumnBefore: {
		canRun: (editor: Editor) => editor.can().chain().addColumnBefore().run(),
		run: (editor: Editor) => editor.chain().focus().addColumnBefore().run(),
	},
	addColumnAfter: {
		canRun: (editor: Editor) => editor.can().chain().addColumnAfter().run(),
		run: (editor: Editor) => editor.chain().focus().addColumnAfter().run(),
	},
	addRowBefore: {
		canRun: (editor: Editor) => editor.can().chain().addRowBefore().run(),
		run: (editor: Editor) => editor.chain().focus().addRowBefore().run(),
	},
	addRowAfter: {
		canRun: (editor: Editor) => editor.can().chain().addRowAfter().run(),
		run: (editor: Editor) => editor.chain().focus().addRowAfter().run(),
	},
	deleteColumn: {
		canRun: (editor: Editor) => editor.can().chain().deleteColumn().run(),
		run: (editor: Editor) => editor.chain().focus().deleteColumn().run(),
	},
	deleteRow: {
		canRun: (editor: Editor) => editor.can().chain().deleteRow().run(),
		run: (editor: Editor) => editor.chain().focus().deleteRow().run(),
	},
	deleteTable: {
		canRun: (editor: Editor) => editor.can().chain().deleteTable().run(),
		run: (editor: Editor) => editor.chain().focus().deleteTable().run(),
	},
} satisfies Record<string, ToolbarButtonStateOptions>;

function useEditorToolbarState(editor: Editor) {
	const prompt = usePrompt();

	const state = useEditorState({
		editor,
		selector: (ctx) => {
			const bold = createToolbarToggleState(ctx.editor, boldToolbarState);
			const italic = createToolbarToggleState(ctx.editor, italicToolbarState);
			const underline = createToolbarToggleState(ctx.editor, underlineToolbarState);
			const strike = createToolbarToggleState(ctx.editor, strikeToolbarState);
			const heading1 = createHeadingToolbarState(ctx.editor, 1);
			const heading2 = createHeadingToolbarState(ctx.editor, 2);
			const heading3 = createHeadingToolbarState(ctx.editor, 3);
			const heading4 = createHeadingToolbarState(ctx.editor, 4);
			const heading5 = createHeadingToolbarState(ctx.editor, 5);
			const heading6 = createHeadingToolbarState(ctx.editor, 6);
			const leftAlign = createTextAlignToolbarState(ctx.editor, "left");
			const centerAlign = createTextAlignToolbarState(ctx.editor, "center");
			const rightAlign = createTextAlignToolbarState(ctx.editor, "right");
			const justifyAlign = createTextAlignToolbarState(ctx.editor, "justify");
			const bulletList = createToolbarToggleState(ctx.editor, bulletListToolbarState);
			const orderedList = createToolbarToggleState(ctx.editor, orderedListToolbarState);
			const liftListItem = createToolbarButtonState(ctx.editor, liftListItemToolbarState);
			const sinkListItem = createToolbarButtonState(ctx.editor, sinkListItemToolbarState);
			const inlineCode = createToolbarToggleState(ctx.editor, inlineCodeToolbarState);
			const codeBlock = createToolbarToggleState(ctx.editor, codeBlockToolbarState);
			const table = Object.fromEntries(
				Object.entries(tableToolbarStates).map(([name, options]) => [
					name,
					createToolbarButtonState(ctx.editor, options),
				]),
			) as Record<keyof typeof tableToolbarStates, ToolbarButtonState>;

			return {
				isBold: bold.isActive,
				canBold: bold.canRun,
				toggleBold: bold.run,

				isItalic: italic.isActive,
				canItalic: italic.canRun,
				toggleItalic: italic.run,

				isUnderline: underline.isActive,
				canUnderline: underline.canRun,
				toggleUnderline: underline.run,

				isStrike: strike.isActive,
				canStrike: strike.canRun,
				toggleStrike: strike.run,

				// Highlight Color
				isHighlight: ctx.editor.isActive("highlight") ?? false,
				highlightColor: (ctx.editor.getAttributes("highlight").color as string | undefined) ?? null,
				canHighlightColor: ctx.editor.can().chain().toggleHighlight().run() ?? false,
				setHighlightColor: (color: string) => ctx.editor.chain().focus().toggleHighlight({ color }).run(),
				unsetHighlightColor: () => ctx.editor.chain().focus().unsetHighlight().run(),

				// Text Color
				textColor: (ctx.editor.getAttributes("textStyle").color as string | undefined) ?? null,
				canTextColor: ctx.editor.can().chain().setColor(defaultTextColor).run() ?? false,
				setTextColor: (color: string) => ctx.editor.chain().focus().setColor(color).run(),
				unsetTextColor: () => ctx.editor.chain().focus().unsetColor().run(),

				isHeading1: heading1.isActive,
				canHeading1: heading1.canRun,
				toggleHeading1: heading1.run,

				isHeading2: heading2.isActive,
				canHeading2: heading2.canRun,
				toggleHeading2: heading2.run,

				isHeading3: heading3.isActive,
				canHeading3: heading3.canRun,
				toggleHeading3: heading3.run,

				isHeading4: heading4.isActive,
				canHeading4: heading4.canRun,
				toggleHeading4: heading4.run,

				isHeading5: heading5.isActive,
				canHeading5: heading5.canRun,
				toggleHeading5: heading5.run,

				isHeading6: heading6.isActive,
				canHeading6: heading6.canRun,
				toggleHeading6: heading6.run,

				// Paragraph
				isParagraph: ctx.editor.isActive("paragraph") ?? false,
				canParagraph: ctx.editor.can().chain().setParagraph().run() ?? false,
				setParagraph: () => ctx.editor.chain().focus().setParagraph().run(),

				isLeftAlign: leftAlign.isActive,
				canLeftAlign: leftAlign.canRun,
				toggleLeftAlign: leftAlign.run,

				isCenterAlign: centerAlign.isActive,
				canCenterAlign: centerAlign.canRun,
				toggleCenterAlign: centerAlign.run,

				isRightAlign: rightAlign.isActive,
				canRightAlign: rightAlign.canRun,
				toggleRightAlign: rightAlign.run,

				isJustifyAlign: justifyAlign.isActive,
				canJustifyAlign: justifyAlign.canRun,
				toggleJustifyAlign: justifyAlign.run,

				isBulletList: bulletList.isActive,
				canBulletList: bulletList.canRun,
				toggleBulletList: bulletList.run,

				isOrderedList: orderedList.isActive,
				canOrderedList: orderedList.canRun,
				toggleOrderedList: orderedList.run,

				canLiftListItem: liftListItem.canRun,
				liftListItem: liftListItem.run,

				canSinkListItem: sinkListItem.canRun,
				sinkListItem: sinkListItem.run,

				// Link
				isLink: ctx.editor.isActive("link") ?? false,
				setLink: async () => {
					const url = await prompt(t`Please enter the URL you want to link to:`, {
						defaultValue: "https://",
					});

					if (!url || url.trim() === "") {
						ctx.editor.chain().focus().unsetLink().run();
						return;
					}

					if (!z.url({ protocol: /^https?$/ }).safeParse(url).success) {
						toast.error(t`The URL you entered is not valid.`, {
							description: t`Valid URLs must start with http:// or https://.`,
						});
						return;
					}

					ctx.editor.chain().focus().setLink({ href: url, target: "_blank", rel: "noopener nofollow" }).run();
				},
				unsetLink: () => ctx.editor.chain().focus().unsetLink().run(),

				isInlineCode: inlineCode.isActive,
				canInlineCode: inlineCode.canRun,
				toggleInlineCode: inlineCode.run,

				isCodeBlock: codeBlock.isActive,
				canCodeBlock: codeBlock.canRun,
				toggleCodeBlock: codeBlock.run,

				insertTable: table.insertTable.run,
				canInsertTable: table.insertTable.canRun,
				addColumnBefore: table.addColumnBefore.run,
				canAddColumnBefore: table.addColumnBefore.canRun,
				addColumnAfter: table.addColumnAfter.run,
				canAddColumnAfter: table.addColumnAfter.canRun,
				addRowBefore: table.addRowBefore.run,
				canAddRowBefore: table.addRowBefore.canRun,
				addRowAfter: table.addRowAfter.run,
				canAddRowAfter: table.addRowAfter.canRun,
				deleteColumn: table.deleteColumn.run,
				canDeleteColumn: table.deleteColumn.canRun,
				deleteRow: table.deleteRow.run,
				canDeleteRow: table.deleteRow.canRun,
				deleteTable: table.deleteTable.run,
				canDeleteTable: table.deleteTable.canRun,

				// Hard Break
				setHardBreak: () => ctx.editor.chain().focus().setHardBreak().run(),

				// Horizontal Rule
				setHorizontalRule: () => ctx.editor.chain().focus().setHorizontalRule().run(),
			};
		},
	});

	return state;
}

type EditorToolbarState = ReturnType<typeof useEditorToolbarState>;

type ToolbarSize = "sm" | "lg";

type ToolbarToggleAction = {
	id: string;
	title: string;
	icon: ReactNode;
	pressed: boolean;
	disabled: boolean;
	onPressedChange: () => void;
};

type ToolbarButtonAction = {
	id: string;
	title?: string;
	icon: ReactNode;
	disabled?: boolean;
	onClick: () => unknown;
};

type ToolbarCheckboxAction = {
	id: string;
	label: ReactNode;
	icon: ReactNode;
	checked: boolean;
	disabled: boolean;
	onCheckedChange: () => void;
};

type ToolbarMenuAction = {
	id: string;
	label: ReactNode;
	icon: ReactNode;
	disabled: boolean;
	variant?: "destructive";
	onClick: () => unknown;
};

export function resolveHighlightToolbarState(isHighlight: boolean, highlightColor: string | null) {
	const visibleHighlightColor = highlightColor ?? (isHighlight ? defaultHighlightColor : undefined);

	return { visibleHighlightColor, canClearHighlight: isHighlight };
}

type EditorToolbarProps = {
	editor: Editor;
	isFullscreen: boolean;
};

function EditorToolbar({ editor, isFullscreen }: EditorToolbarProps) {
	const state = useEditorToolbarState(editor);

	return renderEditorToolbar(state, isFullscreen);
}

type ToolbarToggleProps = {
	action: ToolbarToggleAction;
	size: ToolbarSize;
};

function ToolbarToggle({ action, size }: ToolbarToggleProps) {
	return (
		<Toggle
			size={size}
			tabIndex={-1}
			className="rounded-none"
			title={action.title}
			pressed={action.pressed}
			disabled={action.disabled}
			onPressedChange={action.onPressedChange}
		>
			{action.icon}
		</Toggle>
	);
}

type ToolbarButtonProps = {
	action: ToolbarButtonAction;
	size: ToolbarSize;
};

function ToolbarButton({ action, size }: ToolbarButtonProps) {
	return (
		<Button
			size={size}
			tabIndex={-1}
			variant="ghost"
			className="rounded-none"
			title={action.title}
			disabled={action.disabled}
			onClick={action.onClick}
		>
			{action.icon}
		</Button>
	);
}

type ToolbarSelectMenuProps = {
	actions: ToolbarCheckboxAction[];
	defaultIcon: ReactNode;
	separatorAfter?: string;
	size: ToolbarSize;
};

function ToolbarSelectMenu({ actions, defaultIcon, separatorAfter, size }: ToolbarSelectMenuProps) {
	const activeAction = actions.find((action) => action.checked);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button size={size} tabIndex={-1} variant="ghost" className="rounded-none">
						{activeAction?.icon ?? defaultIcon}
					</Button>
				}
			/>

			<DropdownMenuContent>
				{actions.map((action) => (
					<FragmentWithSeparator key={action.id} separator={action.id === separatorAfter}>
						<DropdownMenuCheckboxItem
							disabled={action.disabled}
							checked={action.checked}
							onCheckedChange={action.onCheckedChange}
						>
							{action.label}
						</DropdownMenuCheckboxItem>
					</FragmentWithSeparator>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

type FragmentWithSeparatorProps = {
	children: ReactNode;
	separator: boolean;
};

function FragmentWithSeparator({ children, separator }: FragmentWithSeparatorProps) {
	return (
		<>
			{children}
			{separator && <DropdownMenuSeparator />}
		</>
	);
}

function renderEditorToolbar(state: EditorToolbarState, isFullscreen: boolean) {
	const { visibleHighlightColor, canClearHighlight } = resolveHighlightToolbarState(
		state.isHighlight,
		state.highlightColor,
	);
	const toolbarSize = isFullscreen ? "lg" : "sm";
	const markActions = [
		{
			id: "bold",
			title: t`Bold`,
			icon: <TextBolderIcon className="size-3.5" />,
			pressed: state.isBold,
			disabled: !state.canBold,
			onPressedChange: state.toggleBold,
		},
		{
			id: "italic",
			title: t`Italic`,
			icon: <TextItalicIcon className="size-3.5" />,
			pressed: state.isItalic,
			disabled: !state.canItalic,
			onPressedChange: state.toggleItalic,
		},
		{
			id: "underline",
			title: t`Underline`,
			icon: <TextUnderlineIcon className="size-3.5" />,
			pressed: state.isUnderline,
			disabled: !state.canUnderline,
			onPressedChange: state.toggleUnderline,
		},
		{
			id: "strike",
			title: t`Strike`,
			icon: <TextStrikethroughIcon className="size-3.5" />,
			pressed: state.isStrike,
			disabled: !state.canStrike,
			onPressedChange: state.toggleStrike,
		},
	] satisfies ToolbarToggleAction[];
	const blockActions = [
		{
			id: "paragraph",
			label: <Trans>Paragraph</Trans>,
			icon: <ParagraphIcon className="size-3.5" />,
			checked: state.isParagraph,
			disabled: !state.canParagraph,
			onCheckedChange: state.setParagraph,
		},
		{
			id: "heading-1",
			label: <Trans>Heading 1</Trans>,
			icon: <TextHOneIcon className="size-3.5" />,
			checked: state.isHeading1,
			disabled: !state.canHeading1,
			onCheckedChange: state.toggleHeading1,
		},
		{
			id: "heading-2",
			label: <Trans>Heading 2</Trans>,
			icon: <TextHTwoIcon className="size-3.5" />,
			checked: state.isHeading2,
			disabled: !state.canHeading2,
			onCheckedChange: state.toggleHeading2,
		},
		{
			id: "heading-3",
			label: <Trans>Heading 3</Trans>,
			icon: <TextHThreeIcon className="size-3.5" />,
			checked: state.isHeading3,
			disabled: !state.canHeading3,
			onCheckedChange: state.toggleHeading3,
		},
		{
			id: "heading-4",
			label: <Trans>Heading 4</Trans>,
			icon: <TextHFourIcon className="size-3.5" />,
			checked: state.isHeading4,
			disabled: !state.canHeading4,
			onCheckedChange: state.toggleHeading4,
		},
		{
			id: "heading-5",
			label: <Trans>Heading 5</Trans>,
			icon: <TextHFiveIcon className="size-3.5" />,
			checked: state.isHeading5,
			disabled: !state.canHeading5,
			onCheckedChange: state.toggleHeading5,
		},
		{
			id: "heading-6",
			label: <Trans>Heading 6</Trans>,
			icon: <TextHSixIcon className="size-3.5" />,
			checked: state.isHeading6,
			disabled: !state.canHeading6,
			onCheckedChange: state.toggleHeading6,
		},
	] satisfies ToolbarCheckboxAction[];
	const alignActions = [
		{
			id: "left",
			label: <Trans>Left Align</Trans>,
			icon: <TextAlignLeftIcon className="size-3.5" />,
			checked: state.isLeftAlign,
			disabled: !state.canLeftAlign,
			onCheckedChange: state.toggleLeftAlign,
		},
		{
			id: "center",
			label: <Trans>Center Align</Trans>,
			icon: <TextAlignCenterIcon className="size-3.5" />,
			checked: state.isCenterAlign,
			disabled: !state.canCenterAlign,
			onCheckedChange: state.toggleCenterAlign,
		},
		{
			id: "right",
			label: <Trans>Right Align</Trans>,
			icon: <TextAlignRightIcon className="size-3.5" />,
			checked: state.isRightAlign,
			disabled: !state.canRightAlign,
			onCheckedChange: state.toggleRightAlign,
		},
		{
			id: "justify",
			label: <Trans>Justify Align</Trans>,
			icon: <TextAlignJustifyIcon className="size-3.5" />,
			checked: state.isJustifyAlign,
			disabled: !state.canJustifyAlign,
			onCheckedChange: state.toggleJustifyAlign,
		},
	] satisfies ToolbarCheckboxAction[];
	const listToggleActions = [
		{
			id: "bullet-list",
			title: t`Bullet List`,
			icon: <ListBulletsIcon className="size-3.5" />,
			pressed: state.isBulletList,
			disabled: !state.canBulletList,
			onPressedChange: state.toggleBulletList,
		},
		{
			id: "ordered-list",
			title: t`Ordered List`,
			icon: <ListNumbersIcon className="size-3.5" />,
			pressed: state.isOrderedList,
			disabled: !state.canOrderedList,
			onPressedChange: state.toggleOrderedList,
		},
	] satisfies ToolbarToggleAction[];
	const listButtonActions = [
		{
			id: "outdent",
			icon: <TextOutdentIcon className="size-3.5" />,
			disabled: !state.canLiftListItem,
			onClick: state.liftListItem,
		},
		{
			id: "indent",
			icon: <TextIndentIcon className="size-3.5" />,
			disabled: !state.canSinkListItem,
			onClick: state.sinkListItem,
		},
	] satisfies ToolbarButtonAction[];
	const codeActions = [
		{
			id: "inline-code",
			title: t`Inline Code`,
			icon: <CodeSimpleIcon className="size-3.5" />,
			pressed: state.isInlineCode,
			disabled: !state.canInlineCode,
			onPressedChange: state.toggleInlineCode,
		},
		{
			id: "code-block",
			title: t`Code Block`,
			icon: <CodeBlockIcon className="size-3.5" />,
			pressed: state.isCodeBlock,
			disabled: !state.canCodeBlock,
			onPressedChange: state.toggleCodeBlock,
		},
	] satisfies ToolbarToggleAction[];
	const tableActionGroups: ToolbarMenuAction[][] = [
		[
			{
				id: "insert-table",
				label: <Trans>Insert Table</Trans>,
				icon: <PlusIcon />,
				disabled: !state.canInsertTable,
				onClick: state.insertTable,
			},
		],
		[
			{
				id: "add-column-before",
				label: <Trans>Add Column Before</Trans>,
				icon: <ColumnsPlusLeftIcon />,
				disabled: !state.canAddColumnBefore,
				onClick: state.addColumnBefore,
			},
			{
				id: "add-column-after",
				label: <Trans>Add Column After</Trans>,
				icon: <ColumnsPlusRightIcon />,
				disabled: !state.canAddColumnAfter,
				onClick: state.addColumnAfter,
			},
		],
		[
			{
				id: "add-row-before",
				label: <Trans>Add Row Before</Trans>,
				icon: <RowsPlusTopIcon />,
				disabled: !state.canAddRowBefore,
				onClick: state.addRowBefore,
			},
			{
				id: "add-row-after",
				label: <Trans>Add Row After</Trans>,
				icon: <RowsPlusBottomIcon />,
				disabled: !state.canAddRowAfter,
				onClick: state.addRowAfter,
			},
		],
		[
			{
				id: "delete-column",
				label: <Trans>Delete Column</Trans>,
				icon: <TrashSimpleIcon />,
				disabled: !state.canDeleteColumn,
				onClick: state.deleteColumn,
			},
			{
				id: "delete-row",
				label: <Trans>Delete Row</Trans>,
				icon: <TrashSimpleIcon />,
				disabled: !state.canDeleteRow,
				onClick: state.deleteRow,
			},
		],
		[
			{
				id: "delete-table",
				label: <Trans>Delete Table</Trans>,
				icon: <TrashSimpleIcon />,
				disabled: !state.canDeleteTable,
				variant: "destructive",
				onClick: state.deleteTable,
			},
		],
	];
	const utilityActions = [
		{
			id: "hard-break",
			title: t`New Line`,
			icon: <KeyReturnIcon className="size-3.5" />,
			onClick: state.setHardBreak,
		},
		{
			id: "horizontal-rule",
			title: t`Separator`,
			icon: <MinusIcon className="size-3.5" />,
			onClick: state.setHorizontalRule,
		},
	] satisfies ToolbarButtonAction[];

	return (
		<div className="flex flex-wrap items-center gap-y-0.5 rounded-md rounded-b-none border border-b-0">
			{markActions.map((action) => (
				<ToolbarToggle key={action.id} action={action} size={toolbarSize} />
			))}

			<ColorPicker
				defaultValue={defaultHighlightColor}
				value={visibleHighlightColor}
				onChange={state.setHighlightColor}
				trigger={
					<PopoverTrigger
						render={
							<Button
								size={toolbarSize}
								tabIndex={-1}
								variant="ghost"
								className={cn("rounded-none px-2", state.isHighlight && "bg-muted text-foreground")}
								title={t`Highlight`}
								disabled={!state.canHighlightColor}
							>
								<span className="flex flex-col items-center leading-none">
									<HighlighterCircleIcon className="size-3.5" />
									<span
										className="mt-0.5 h-0.5 w-3 rounded-full"
										style={{ backgroundColor: visibleHighlightColor ?? "currentColor" }}
									/>
								</span>
							</Button>
						}
					/>
				}
			>
				<PopoverHeader className="flex-row items-start justify-between gap-2">
					<div className="flex items-center gap-2.5">
						<span
							className="grid size-9 place-items-center rounded-lg border border-border bg-muted/60 text-sm shadow-xs"
							style={{ backgroundColor: visibleHighlightColor ?? defaultHighlightColor }}
						>
							<HighlighterCircleIcon className="size-4" />
						</span>

						<div className="flex flex-col gap-0.5">
							<PopoverTitle>
								<Trans>Highlight Color</Trans>
							</PopoverTitle>
							<span className="text-muted-foreground text-xs">
								<Trans comment="Preset or custom shade refer to the color picker">
									Choose a preset or custom shade.
								</Trans>
							</span>
						</div>
					</div>

					<Button
						size="xs"
						variant="ghost"
						className="shrink-0"
						onClick={state.unsetHighlightColor}
						disabled={!canClearHighlight}
					>
						<Trans comment="Clear the highlight color">Clear</Trans>
					</Button>
				</PopoverHeader>
			</ColorPicker>

			<ColorPicker
				defaultValue={defaultTextColor}
				value={state.textColor ?? undefined}
				onChange={state.setTextColor}
				trigger={
					<PopoverTrigger
						render={
							<Button
								size={toolbarSize}
								tabIndex={-1}
								variant="ghost"
								className={cn("rounded-none px-2", state.textColor && "bg-muted text-foreground")}
								title={t`Text Color`}
								disabled={!state.canTextColor}
							>
								<span className="flex flex-col items-center leading-none">
									<span className="font-semibold text-xs">A</span>
									<span
										className="mt-0.5 h-0.5 w-3 rounded-full"
										style={{ backgroundColor: state.textColor ?? "currentColor" }}
									/>
								</span>
							</Button>
						}
					/>
				}
			>
				<PopoverHeader className="flex-row items-start justify-between gap-2">
					<div className="flex items-center gap-2.5">
						<span
							className="grid size-9 place-items-center rounded-lg border border-border bg-muted/60 font-semibold text-sm shadow-xs"
							style={{ color: state.textColor ?? "currentColor" }}
						>
							A
						</span>

						<div className="flex flex-col gap-0.5">
							<PopoverTitle>
								<Trans>Text Color</Trans>
							</PopoverTitle>
							<span className="text-muted-foreground text-xs">
								<Trans comment="Preset or custom shade refer to the color picker">
									Choose a preset or custom shade.
								</Trans>
							</span>
						</div>
					</div>

					<Button
						size="xs"
						variant="ghost"
						className="shrink-0"
						onClick={state.unsetTextColor}
						disabled={!state.textColor}
					>
						<Trans comment="Clear the text color">Clear</Trans>
					</Button>
				</PopoverHeader>
			</ColorPicker>

			<div className="mx-1 h-5 w-px bg-border" />

			<ToolbarSelectMenu
				actions={blockActions}
				defaultIcon={<ParagraphIcon className="size-3.5" />}
				separatorAfter="paragraph"
				size={toolbarSize}
			/>

			<ToolbarSelectMenu
				actions={alignActions}
				defaultIcon={<TextAlignLeftIcon className="size-3.5" />}
				size={toolbarSize}
			/>

			<div className="mx-1 h-5 w-px bg-border" />

			{listToggleActions.map((action) => (
				<ToolbarToggle key={action.id} action={action} size={toolbarSize} />
			))}

			{listButtonActions.map((action) => (
				<ToolbarButton key={action.id} action={action} size={toolbarSize} />
			))}

			<div className="mx-1 h-5 w-px bg-border" />

			{state.isLink ? (
				<Button size={toolbarSize} tabIndex={-1} variant="ghost" className="rounded-none" onClick={state.unsetLink}>
					<LinkBreakIcon className="size-3.5" />
				</Button>
			) : (
				<Button size={toolbarSize} tabIndex={-1} variant="ghost" className="rounded-none" onClick={state.setLink}>
					<LinkIcon className="size-3.5" />
				</Button>
			)}

			{codeActions.map((action) => (
				<ToolbarToggle key={action.id} action={action} size={toolbarSize} />
			))}

			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button size={toolbarSize} tabIndex={-1} variant="ghost" className="rounded-none" title={t`Table`}>
							<TableIcon className="size-3.5" />
						</Button>
					}
				/>

				<DropdownMenuContent>
					{tableActionGroups.map((group, index) => (
						<FragmentWithSeparator
							key={group.map((action) => action.id).join("-")}
							separator={index < tableActionGroups.length - 1}
						>
							{group.map((action) => (
								<DropdownMenuItem
									key={action.id}
									variant={action.variant}
									disabled={action.disabled}
									onClick={action.onClick}
								>
									{action.icon}
									{action.label}
								</DropdownMenuItem>
							))}
						</FragmentWithSeparator>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			{utilityActions.map((action) => (
				<ToolbarButton key={action.id} action={action} size={toolbarSize} />
			))}
		</div>
	);
}
