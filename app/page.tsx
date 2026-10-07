import HomeFamilyContent from "./home-family-content";

export default function Home() {
  return <HomeFamilyContent basePath={process.env.NEXT_PUBLIC_BASE_PATH ?? ""} />;
}
