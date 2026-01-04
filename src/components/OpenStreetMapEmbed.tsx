import React from "react";

type Props = {
  latitude: number;
  longitude: number;
  zoom?: number;
  height?: string;
  title?: string;
};

export default function OpenStreetMapEmbed({
  latitude,
  longitude,
  zoom = 15,
  height = "400px",
  title = "Map",
}: Props) {
  // OpenStreetMap embed supports marker via mlat/mlon.
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${
    longitude - 0.01
  }%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${
    latitude + 0.01
  }&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return (
    <iframe
      title={title}
      src={src}
      style={{ height, width: "100%" }}
      className="rounded-lg border border-border"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
    />
  );
}
