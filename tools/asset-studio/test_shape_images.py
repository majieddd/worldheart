import unittest
from PIL import Image,ImageDraw
from shape_images import figures,single_figure,crop_figure
class ShapeImagesTests(unittest.TestCase):
    def test_sheet_rejected_and_selected_figure_keeps_pixels(self):
        im=Image.new('RGBA',(300,400));d=ImageDraw.Draw(im)
        d.rectangle((20,10,90,380),fill=(30,150,200,255));d.rectangle((180,10,260,380),fill=(240,90,10,255))
        self.assertEqual(len(figures(im)),2)
        with self.assertRaisesRegex(ValueError,'2 separate'):single_figure(im,'front')
        cropped,box=crop_figure(im,1)
        self.assertEqual(box,[180,10,261,381]);self.assertEqual(cropped.getpixel((20,20)),(240,90,10,255))
        single_figure(cropped,'front')
    def test_small_detached_details_do_not_count_as_second_body(self):
        im=Image.new('RGBA',(300,400));d=ImageDraw.Draw(im)
        d.rectangle((100,10,200,390),fill='red');d.rectangle((10,300,25,360),fill='blue')
        self.assertEqual(len(figures(im)),1)
        with self.assertRaises(ValueError):crop_figure(im,9)
