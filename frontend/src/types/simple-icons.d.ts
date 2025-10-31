// Minimal type shims for simple-icons ESM icon modules
// This allows TypeScript to type-check without the package installed locally.
declare module "simple-icons/icons/*" {
  const icon: {
    title: string;
    slug: string;
    hex: string;
    path: string;
  };
  export default icon;
}
