declare module "*.css";
declare module "*?url" {
	const url: string;
	export default url;
}
declare module "@fontsource/*" {}
declare module "@fontsource-variable/*" {}
