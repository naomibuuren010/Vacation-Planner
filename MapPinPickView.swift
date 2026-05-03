import SwiftUI
import CoreLocation
import MapKit
import UIKit

struct MapPinPickView: View {
    var initialCoordinate: CLLocationCoordinate2D?
    var onPick: (CLLocationCoordinate2D) -> Void

    @Environment(\.dismiss) private var dismiss

    @State private var pickedCoordinate: CLLocationCoordinate2D?

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                MapPinPickMapRepresentable(
                    initialCoordinate: initialCoordinate,
                    onCoordinatePicked: { coordinate in
                        pickedCoordinate = coordinate
                    }
                )
                .ignoresSafeArea()

                VStack(alignment: .leading, spacing: 12) {
                    if let pickedCoordinate {
                        Text("Gekozen locatie")
                            .font(.headline)

                        Text("\(pickedCoordinate.latitude, specifier: "%.5f") , \(pickedCoordinate.longitude, specifier: "%.5f")")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    } else {
                        Text("Tik op de kaart om een pin te zetten.")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }

                    Button {
                        guard let pickedCoordinate else { return }
                        onPick(pickedCoordinate)
                        dismiss()
                    } label: {
                        Label("Gebruik deze locatie", systemImage: "checkmark.circle.fill")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(pickedCoordinate == nil)
                    .buttonStyle(.borderedProminent)
                }
                .padding()
                .background(.thinMaterial)
            }
            .navigationTitle("Kies op kaart")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuleer") { dismiss() }
                }
            }
            .onAppear {
                pickedCoordinate = initialCoordinate
            }
        }
    }
}

private struct MapPinPickMapRepresentable: UIViewRepresentable {
    let initialCoordinate: CLLocationCoordinate2D?
    let onCoordinatePicked: (CLLocationCoordinate2D) -> Void

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView(frame: .zero)
        mapView.isRotateEnabled = false
        mapView.showsCompass = false

        if let initialCoordinate {
            let region = MKCoordinateRegion(
                center: initialCoordinate,
                span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)
            )
            mapView.setRegion(region, animated: false)

            let annotation = MKPointAnnotation()
            annotation.coordinate = initialCoordinate
            mapView.addAnnotation(annotation)
        } else {
            mapView.setRegion(
                MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: 0, longitude: 0),
                    span: MKCoordinateSpan(latitudeDelta: 120, longitudeDelta: 120)
                ),
                animated: false
            )
        }

        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.handleTap(_:)))
        mapView.addGestureRecognizer(tap)

        return mapView
    }

    func updateUIView(_ uiView: MKMapView, context: Context) {
        // Geen-op-update: picking gebeurt via tap.
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onCoordinatePicked: onCoordinatePicked)
    }

    final class Coordinator: NSObject {
        let onCoordinatePicked: (CLLocationCoordinate2D) -> Void

        init(onCoordinatePicked: @escaping (CLLocationCoordinate2D) -> Void) {
            self.onCoordinatePicked = onCoordinatePicked
        }

        @objc func handleTap(_ gesture: UITapGestureRecognizer) {
            guard let mapView = gesture.view as? MKMapView else { return }

            let point = gesture.location(in: mapView)
            let coordinate = mapView.convert(point, toCoordinateFrom: mapView)

            mapView.removeAnnotations(mapView.annotations)
            let annotation = MKPointAnnotation()
            annotation.coordinate = coordinate
            mapView.addAnnotation(annotation)

            onCoordinatePicked(coordinate)
        }
    }
}

