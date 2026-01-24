interface InfoBoxComponentProps {
  locationName: string;
}

export function InfoBoxComponent(props: InfoBoxComponentProps) {
  return (
    <div className="fixed bottom-5 right-5 rounded-md min-w-64 flex flex-col z-10 bg-white text-7xl">
      <p>{props.locationName}</p>
    </div>
  );
}
